import { randomUUID } from "node:crypto";
import { In, type DataSource, type EntityManager } from "typeorm";
import type { DesignRepository } from "@/server/design/repositories/DesignRepository";
import type {
  AuditEvent,
  DesignRecord,
  DesignSnapshot,
  DesignWriteResult,
  PersistenceContext,
  WriteCommand,
} from "@/server/design/models";
import {
  AuditEventSchema,
  DesignRevisionSchema,
  DesignSchema,
  IdempotencySchema,
  type AuditEventEntity,
  type DesignEntity,
  type DesignRevisionEntity,
  type IdempotencyEntity,
} from "@/server/persistence/entities";

const toSnapshot = (revision: DesignRevisionEntity): DesignSnapshot => ({
  id: revision.id,
  designId: revision.designId,
  kind: revision.kind,
  document: structuredClone(revision.document),
  createdAt: revision.createdAt.toISOString(),
  createdByActorId: revision.createdByActorId,
});

const toAuditEntity = (event: AuditEvent): AuditEventEntity => ({
  id: event.id,
  workspaceId: event.workspaceId,
  actorId: event.actorId,
  correlationId: event.correlationId,
  authenticationMethod: event.authenticationMethod,
  action: event.action,
  resourceType: event.resourceType,
  resourceId: event.resourceId,
  resultId: event.resultId ?? null,
  outcome: event.outcome,
  createdAt: new Date(event.createdAt),
});

export class TypeOrmDesignRepository implements DesignRepository {
  constructor(private readonly dataSource: DataSource) {}

  async listByWorkspace(context: PersistenceContext) {
    return this.dataSource.transaction(async (manager) => {
      const designs = await manager.getRepository(DesignSchema).find({
        where: { workspaceId: context.workspaceId },
        order: { updatedAt: "DESC", id: "ASC" },
      });
      const records = await this.loadRecords(manager, designs);
      await this.saveAudit(
        manager,
        context,
        "design.list",
        "workspace",
        context.workspaceId,
      );
      return records;
    });
  }

  async findById(context: PersistenceContext, designId: string) {
    return this.dataSource.transaction(async (manager) => {
      const design = await manager.getRepository(DesignSchema).findOne({
        where: { id: designId, workspaceId: context.workspaceId },
      });
      const record = design ? await this.loadRecord(manager, design) : null;
      await this.saveAudit(
        manager,
        context,
        "design.read",
        "design",
        designId,
        record?.currentSnapshotId,
      );
      return record;
    });
  }

  async findSnapshot(
    context: PersistenceContext,
    designId: string,
    revisionId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const design = await manager.getRepository(DesignSchema).findOne({
        where: { id: designId, workspaceId: context.workspaceId },
      });
      const revision = design
        ? await manager.getRepository(DesignRevisionSchema).findOne({
            where: { id: revisionId, designId },
          })
        : null;
      await this.saveAudit(
        manager,
        context,
        "revision.read",
        "revision",
        revisionId,
        revision?.id,
      );
      if (!design || !revision) return null;
      return {
        record: await this.loadRecord(manager, design),
        snapshot: toSnapshot(revision),
      };
    });
  }

  async create(
    record: DesignRecord,
    command: WriteCommand,
  ): Promise<DesignWriteResult> {
    return this.dataSource.transaction(async (manager) => {
      const replay = await this.replay(manager, command);
      if (replay) return replay;
      const existing = await manager.getRepository(DesignSchema).findOne({
        where: { id: record.id },
      });
      if (existing) {
        await this.saveAudit(
          manager,
          command,
          command.operation,
          "design",
          record.id,
          undefined,
          "failure",
        );
        return { status: "duplicate" };
      }

      const snapshot = record.snapshots.find(
        (candidate) => candidate.id === record.currentSnapshotId,
      );
      if (!snapshot) throw new Error("A new Design must include its head revision.");
      const createdAt = new Date(record.createdAt);
      await manager.getRepository(DesignSchema).save({
        id: record.id,
        workspaceId: record.workspaceId,
        name: snapshot.document.metadata.name,
        headRevisionId: null,
        createdAt,
        updatedAt: new Date(record.updatedAt),
      });
      await manager.getRepository(DesignRevisionSchema).save(
        this.revisionEntity(snapshot),
      );
      await manager.getRepository(DesignSchema).update(
        { id: record.id, workspaceId: command.workspaceId },
        { headRevisionId: snapshot.id, updatedAt: new Date(record.updatedAt) },
      );
      await this.remember(manager, command, record.id, snapshot.id);
      await this.saveAudit(
        manager,
        command,
        command.operation,
        "design",
        record.id,
        snapshot.id,
      );
      return { status: "applied", record: structuredClone(record) };
    });
  }

  async appendDraft(
    designId: string,
    snapshot: DesignSnapshot,
    expectedRevisionId: string,
    command: WriteCommand,
  ): Promise<DesignWriteResult> {
    return this.dataSource.transaction(async (manager) => {
      const replay = await this.replay(manager, command);
      if (replay) return replay;
      const repository = manager.getRepository(DesignSchema);
      const design = await repository.findOne({
        where: { id: designId, workspaceId: command.workspaceId },
        lock: { mode: "pessimistic_write" },
      });
      if (!design) {
        await this.saveAudit(
          manager,
          command,
          command.operation,
          "design",
          designId,
          undefined,
          "failure",
        );
        return { status: "not-found" };
      }
      if (design.headRevisionId !== expectedRevisionId) {
        await this.saveAudit(
          manager,
          command,
          command.operation,
          "design",
          designId,
          design.headRevisionId ?? undefined,
          "failure",
        );
        return {
          status: "revision-conflict",
          currentRevisionId: design.headRevisionId ?? expectedRevisionId,
        };
      }

      await manager.getRepository(DesignRevisionSchema).save(
        this.revisionEntity(snapshot),
      );
      design.headRevisionId = snapshot.id;
      design.name = snapshot.document.metadata.name;
      design.updatedAt = new Date(snapshot.createdAt);
      await repository.save(design);
      await this.remember(manager, command, designId, snapshot.id);
      await this.saveAudit(
        manager,
        command,
        command.operation,
        "revision",
        snapshot.id,
        snapshot.id,
      );
      const record = await this.loadRecord(manager, design);
      return { status: "applied", record };
    });
  }

  async recordDenied(event: AuditEvent) {
    await this.dataSource
      .getRepository(AuditEventSchema)
      .save(toAuditEntity(event));
  }

  private async loadRecords(manager: EntityManager, designs: DesignEntity[]) {
    if (designs.length === 0) return [];
    const revisions = await manager.getRepository(DesignRevisionSchema).find({
      where: { designId: In(designs.map((design) => design.id)) },
      order: { createdAt: "ASC", id: "ASC" },
    });
    return designs.map((design) =>
      this.mapRecord(
        design,
        revisions.filter((revision) => revision.designId === design.id),
      ),
    );
  }

  private async loadRecord(
    manager: EntityManager,
    design: DesignEntity,
    headRevisionId = design.headRevisionId,
  ) {
    const revisions = await manager.getRepository(DesignRevisionSchema).find({
      where: { designId: design.id },
      order: { createdAt: "ASC", id: "ASC" },
    });
    return this.mapRecord(design, revisions, headRevisionId);
  }

  private mapRecord(
    design: DesignEntity,
    revisions: DesignRevisionEntity[],
    headRevisionId = design.headRevisionId,
  ): DesignRecord {
    if (!headRevisionId) {
      throw new Error(`Design '${design.id}' has no committed head revision.`);
    }
    return {
      id: design.id,
      workspaceId: design.workspaceId,
      currentSnapshotId: headRevisionId,
      snapshots: revisions.map(toSnapshot),
      createdAt: design.createdAt.toISOString(),
      updatedAt: design.updatedAt.toISOString(),
    };
  }

  private revisionEntity(snapshot: DesignSnapshot): DesignRevisionEntity {
    return {
      id: snapshot.id,
      designId: snapshot.designId,
      kind: snapshot.kind,
      document: structuredClone(snapshot.document),
      createdAt: new Date(snapshot.createdAt),
      createdByActorId: snapshot.createdByActorId,
    };
  }

  private async replay(
    manager: EntityManager,
    command: WriteCommand,
  ): Promise<DesignWriteResult | null> {
    if (!command.idempotencyKey) return null;
    const repository = manager.getRepository(IdempotencySchema);
    const remembered = await repository.findOne({
      where: {
        workspaceId: command.workspaceId,
        actorId: command.actorId,
        operation: command.operation,
        idempotencyKey: command.idempotencyKey,
      },
      lock: { mode: "pessimistic_write" },
    });
    if (!remembered) return null;
    if (remembered.expiresAt.getTime() <= Date.now()) {
      await repository.remove(remembered);
      return null;
    }
    if (remembered.requestFingerprint !== command.requestFingerprint) {
      await this.saveAudit(
        manager,
        command,
        command.operation,
        "design",
        remembered.resultDesignId,
        remembered.resultRevisionId,
        "failure",
      );
      return { status: "idempotency-conflict" };
    }
    const design = await manager.getRepository(DesignSchema).findOne({
      where: { id: remembered.resultDesignId, workspaceId: command.workspaceId },
    });
    if (!design) throw new Error("Idempotency result Design is missing.");
    const record = await this.loadRecord(
      manager,
      design,
      remembered.resultRevisionId,
    );
    await this.saveAudit(
      manager,
      command,
      `${command.operation}.replay`,
      "revision",
      remembered.resultRevisionId,
      remembered.resultRevisionId,
    );
    return { status: "replayed", record };
  }

  private async remember(
    manager: EntityManager,
    command: WriteCommand,
    designId: string,
    revisionId: string,
  ) {
    if (!command.idempotencyKey) return;
    const entity: IdempotencyEntity = {
      id: randomUUID(),
      workspaceId: command.workspaceId,
      actorId: command.actorId,
      operation: command.operation,
      idempotencyKey: command.idempotencyKey,
      requestFingerprint: command.requestFingerprint,
      resultDesignId: designId,
      resultRevisionId: revisionId,
      expiresAt: new Date(command.idempotencyExpiresAt),
      createdAt: new Date(),
    };
    await manager.getRepository(IdempotencySchema).save(entity);
  }

  private async saveAudit(
    manager: EntityManager,
    context: PersistenceContext,
    action: string,
    resourceType: AuditEvent["resourceType"],
    resourceId: string,
    resultId?: string,
    outcome: AuditEvent["outcome"] = "success",
  ) {
    await manager.getRepository(AuditEventSchema).save({
      id: randomUUID(),
      workspaceId: context.workspaceId,
      actorId: context.actorId,
      correlationId: context.correlationId,
      authenticationMethod: context.authenticationMethod,
      action,
      resourceType,
      resourceId,
      resultId: resultId ?? null,
      outcome,
      createdAt: new Date(),
    });
  }
}
