import type { DesignRepository } from "@/server/design/repositories/DesignRepository";
import type {
  AuditEvent,
  DesignRecord,
  DesignSnapshot,
  DesignWriteResult,
  PersistenceContext,
  WriteCommand,
} from "@/server/design/models";

const cloneRecord = (record: DesignRecord): DesignRecord => structuredClone(record);

export class InMemoryDesignRepository implements DesignRepository {
  private readonly records = new Map<string, DesignRecord>();
  private readonly idempotency = new Map<
    string,
    { fingerprint: string; designId: string; revisionId: string; expiresAt: string }
  >();
  private readonly auditEvents: AuditEvent[] = [];
  private failBeforeCommit = false;

  constructor(seedRecords: DesignRecord[] = []) {
    for (const record of seedRecords) this.records.set(record.id, cloneRecord(record));
  }

  async listByWorkspace(context: PersistenceContext) {
    const records = [...this.records.values()]
      .filter((record) => record.workspaceId === context.workspaceId)
      .map(cloneRecord)
      .sort((left, right) => left.id.localeCompare(right.id));
    this.auditEvents.push(
      this.audit(context, "design.list", "workspace", context.workspaceId),
    );
    return records;
  }

  async findById(context: PersistenceContext, designId: string) {
    const record = this.records.get(designId);
    const visible = record?.workspaceId === context.workspaceId ? cloneRecord(record) : null;
    this.auditEvents.push(
      this.audit(context, "design.read", "design", designId, visible?.currentSnapshotId),
    );
    return visible;
  }

  async findSnapshot(
    context: PersistenceContext,
    designId: string,
    revisionId: string,
  ) {
    const record = this.records.get(designId);
    if (!record || record.workspaceId !== context.workspaceId) {
      this.auditEvents.push(
        this.audit(context, "revision.read", "revision", revisionId),
      );
      return null;
    }
    const snapshot = record.snapshots.find((candidate) => candidate.id === revisionId);
    this.auditEvents.push(
      this.audit(context, "revision.read", "revision", revisionId, snapshot?.id),
    );
    return snapshot
      ? { record: cloneRecord(record), snapshot: structuredClone(snapshot) }
      : null;
  }

  async create(record: DesignRecord, command: WriteCommand): Promise<DesignWriteResult> {
    const replay = this.replay(command);
    if (replay) return replay;
    if (this.records.has(record.id)) {
      this.auditEvents.push(
        this.audit(command, command.operation, "design", record.id, undefined, "failure"),
      );
      return { status: "duplicate" };
    }
    if (this.failBeforeCommit) {
      this.failBeforeCommit = false;
      throw new Error("Injected transaction failure");
    }
    const committed = cloneRecord(record);
    this.records.set(record.id, committed);
    this.remember(command, record.id, record.currentSnapshotId);
    this.auditEvents.push(
      this.audit(command, "design.create", "design", record.id, record.currentSnapshotId),
    );
    return { status: "applied", record: cloneRecord(committed) };
  }

  async appendDraft(
    designId: string,
    snapshot: DesignSnapshot,
    expectedRevisionId: string,
    command: WriteCommand,
  ): Promise<DesignWriteResult> {
    const replay = this.replay(command);
    if (replay) return replay;
    const existing = this.records.get(designId);
    if (!existing || existing.workspaceId !== command.workspaceId) {
      this.auditEvents.push(
        this.audit(command, command.operation, "design", designId, undefined, "failure"),
      );
      return { status: "not-found" };
    }
    if (existing.currentSnapshotId !== expectedRevisionId) {
      this.auditEvents.push(
        this.audit(
          command,
          command.operation,
          "design",
          designId,
          existing.currentSnapshotId,
          "failure",
        ),
      );
      return {
        status: "revision-conflict",
        currentRevisionId: existing.currentSnapshotId,
      };
    }
    if (this.failBeforeCommit) {
      this.failBeforeCommit = false;
      throw new Error("Injected transaction failure");
    }
    const updated: DesignRecord = {
      ...existing,
      currentSnapshotId: snapshot.id,
      snapshots: [...existing.snapshots, structuredClone(snapshot)],
      updatedAt: snapshot.createdAt,
    };
    this.records.set(designId, cloneRecord(updated));
    this.remember(command, designId, snapshot.id);
    this.auditEvents.push(
      this.audit(command, "design.save-draft", "revision", snapshot.id, snapshot.id),
    );
    return { status: "applied", record: cloneRecord(updated) };
  }

  async recordDenied(event: AuditEvent) {
    this.auditEvents.push(structuredClone(event));
  }

  getAuditEvents() {
    return structuredClone(this.auditEvents);
  }

  injectFailureBeforeCommit() {
    this.failBeforeCommit = true;
  }

  private idempotencyIdentity(command: WriteCommand) {
    return command.idempotencyKey
      ? [
          command.workspaceId,
          command.actorId,
          command.operation,
          command.idempotencyKey,
        ].join(":")
      : null;
  }

  private replay(command: WriteCommand): DesignWriteResult | null {
    const identity = this.idempotencyIdentity(command);
    if (!identity) return null;
    const remembered = this.idempotency.get(identity);
    if (!remembered || remembered.expiresAt <= new Date().toISOString()) return null;
    if (remembered.fingerprint !== command.requestFingerprint) {
      this.auditEvents.push(
        this.audit(
          command,
          command.operation,
          "design",
          remembered.designId,
          remembered.revisionId,
          "failure",
        ),
      );
      return { status: "idempotency-conflict" };
    }
    const record = this.records.get(remembered.designId);
    const snapshot = record?.snapshots.find(
      (candidate) => candidate.id === remembered.revisionId,
    );
    if (!record || !snapshot) return null;
    return {
      status: "replayed",
      record: {
        ...cloneRecord(record),
        currentSnapshotId: snapshot.id,
      },
    };
  }

  private remember(command: WriteCommand, designId: string, revisionId: string) {
    const identity = this.idempotencyIdentity(command);
    if (!identity) return;
    this.idempotency.set(identity, {
      fingerprint: command.requestFingerprint,
      designId,
      revisionId,
      expiresAt: command.idempotencyExpiresAt,
    });
  }

  private audit(
    context: PersistenceContext,
    action: string,
    resourceType: AuditEvent["resourceType"],
    resourceId: string,
    resultId?: string,
    outcome: AuditEvent["outcome"] = "success",
  ): AuditEvent {
    return {
      ...context,
      id: `audit-${this.auditEvents.length + 1}`,
      action,
      resourceType,
      resourceId,
      resultId,
      outcome,
      createdAt: new Date().toISOString(),
    };
  }
}
