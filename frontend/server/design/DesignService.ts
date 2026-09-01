import {
  applyDesignOperations,
  createProductionId,
  validateDesignDocument,
  type DesignDocument,
  type DesignOperation,
} from "@/domain/design";
import {
  authorizeRead,
  authorizeWorkspace,
  authorizeWrite,
} from "@/server/design/authorization";
import type { DesignRepository } from "@/server/design/repositories/DesignRepository";
import type {
  ActorContext,
  ApplicationFailure,
  ApplicationResult,
  DesignHead,
  DesignRecord,
  DesignSnapshot,
  DesignSummary,
  OperationValidation,
} from "@/server/design/models";

type ServiceOptions = {
  createId?: (prefix: string) => string;
  now?: () => string;
};

const notFound = (
  actor: ActorContext,
  designId: string,
  currentRevisionId?: string,
): ApplicationFailure => ({
  ok: false,
  error: {
    code: "not-found",
    message: `Design '${designId}' was not found.`,
    recoveryHint: "Refresh the Design list and use an ID visible to this actor.",
  },
  correlationId: actor.correlationId,
  currentRevisionId,
});

const currentSnapshot = (record: DesignRecord) =>
  record.snapshots.find((snapshot) => snapshot.id === record.currentSnapshotId);

const toSummary = (record: DesignRecord): DesignSummary => {
  const snapshot = currentSnapshot(record);
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    name: snapshot?.document.metadata.name ?? record.id,
    currentRevisionId: record.currentSnapshotId,
    updatedAt: record.updatedAt,
  };
};

export class DesignService {
  private readonly createId: (prefix: string) => string;
  private readonly now: () => string;

  constructor(
    private readonly repository: DesignRepository,
    options: ServiceOptions = {},
  ) {
    this.createId = options.createId ?? createProductionId;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async listDesigns(actor: ActorContext): Promise<ApplicationResult<DesignSummary[]>> {
    const denied = authorizeRead(actor);
    if (denied) return denied;
    try {
      const records = await this.repository.listByWorkspace(actor.workspaceId);
      return {
        ok: true,
        data: records.map(toSummary),
        correlationId: actor.correlationId,
      };
    } catch {
      return this.internalFailure(actor);
    }
  }

  async createDesign(
    actor: ActorContext,
    document: DesignDocument,
  ): Promise<ApplicationResult<DesignHead>> {
    const denied = authorizeWrite(actor);
    if (denied) return denied;
    const validationFailure = this.validateDocument(actor, document);
    if (validationFailure) return validationFailure;
    try {
      if (await this.repository.findById(document.id)) {
        return {
          ok: false,
          error: {
            code: "conflict",
            message: `Design '${document.id}' already exists.`,
            recoveryHint: "Use a new Design ID or fetch the existing Design.",
          },
          correlationId: actor.correlationId,
        };
      }
      const timestamp = this.now();
      const snapshot: DesignSnapshot = {
        id: this.createId("revision"),
        designId: document.id,
        kind: "initial",
        document: structuredClone(document),
        createdAt: timestamp,
        createdByActorId: actor.actorId,
      };
      const record: DesignRecord = {
        id: document.id,
        workspaceId: actor.workspaceId,
        currentSnapshotId: snapshot.id,
        snapshots: [snapshot],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await this.repository.save(record);
      return {
        ok: true,
        data: { designId: record.id, currentRevisionId: snapshot.id, snapshot },
        correlationId: actor.correlationId,
        currentRevisionId: snapshot.id,
      };
    } catch {
      return this.internalFailure(actor);
    }
  }

  async getDesignHead(
    actor: ActorContext,
    designId: string,
  ): Promise<ApplicationResult<DesignHead>> {
    const denied = authorizeRead(actor);
    if (denied) return denied;
    try {
      const record = await this.repository.findById(designId);
      if (!record) return notFound(actor, designId);
      const workspaceDenied = authorizeWorkspace(actor, record.workspaceId);
      if (workspaceDenied) return workspaceDenied;
      const snapshot = currentSnapshot(record);
      if (!snapshot) return this.internalFailure(actor, record.currentSnapshotId);
      return {
        ok: true,
        data: {
          designId,
          currentRevisionId: snapshot.id,
          snapshot,
        },
        correlationId: actor.correlationId,
        currentRevisionId: snapshot.id,
      };
    } catch {
      return this.internalFailure(actor);
    }
  }

  async getSnapshot(
    actor: ActorContext,
    designId: string,
    revisionId: string,
  ): Promise<ApplicationResult<DesignSnapshot>> {
    const denied = authorizeRead(actor);
    if (denied) return denied;
    try {
      const record = await this.repository.findById(designId);
      if (!record) return notFound(actor, designId);
      const workspaceDenied = authorizeWorkspace(actor, record.workspaceId);
      if (workspaceDenied) return workspaceDenied;
      const snapshot = record.snapshots.find((candidate) => candidate.id === revisionId);
      if (!snapshot) return notFound(actor, `${designId}/revisions/${revisionId}`, record.currentSnapshotId);
      return {
        ok: true,
        data: snapshot,
        correlationId: actor.correlationId,
        currentRevisionId: record.currentSnapshotId,
      };
    } catch {
      return this.internalFailure(actor);
    }
  }

  async validateOperations(
    actor: ActorContext,
    designId: string,
    operations: DesignOperation[],
  ): Promise<ApplicationResult<OperationValidation>> {
    const head = await this.getDesignHead(actor, designId);
    if (!head.ok) return head;
    const application = applyDesignOperations(head.data.snapshot.document, operations);
    if (!application.ok) {
      return {
        ok: true,
        data: {
          valid: false,
          currentRevisionId: head.currentRevisionId ?? head.data.currentRevisionId,
          issues: application.errors,
        },
        correlationId: actor.correlationId,
        currentRevisionId: head.currentRevisionId,
      };
    }
    return {
      ok: true,
      data: {
        valid: true,
        currentRevisionId: head.currentRevisionId ?? head.data.currentRevisionId,
        candidateDocument: application.document,
        issues: application.warnings,
      },
      correlationId: actor.correlationId,
      currentRevisionId: head.currentRevisionId,
    };
  }

  async saveDraft(
    actor: ActorContext,
    designId: string,
    document: DesignDocument,
    expectedRevisionId: string,
  ): Promise<ApplicationResult<DesignHead>> {
    const denied = authorizeWrite(actor);
    if (denied) return denied;
    const validationFailure = this.validateDocument(actor, document);
    if (validationFailure) return validationFailure;
    if (document.id !== designId) {
      return {
        ok: false,
        error: {
          code: "conflict",
          message: "The route Design ID does not match the document ID.",
          recoveryHint: "Save the document through the endpoint matching its stable ID.",
        },
        correlationId: actor.correlationId,
      };
    }
    try {
      const record = await this.repository.findById(designId);
      if (!record) return notFound(actor, designId);
      const workspaceDenied = authorizeWorkspace(actor, record.workspaceId);
      if (workspaceDenied) return workspaceDenied;
      if (record.currentSnapshotId !== expectedRevisionId) {
        return {
          ok: false,
          error: {
            code: "conflict",
            message: "The Design changed after this draft was loaded.",
            recoveryHint: "Refetch the current snapshot before saving again.",
          },
          correlationId: actor.correlationId,
          currentRevisionId: record.currentSnapshotId,
        };
      }
      const timestamp = this.now();
      const snapshot: DesignSnapshot = {
        id: this.createId("draft"),
        designId,
        kind: "draft",
        document: structuredClone(document),
        createdAt: timestamp,
        createdByActorId: actor.actorId,
      };
      const updated: DesignRecord = {
        ...record,
        currentSnapshotId: snapshot.id,
        snapshots: [...record.snapshots, snapshot],
        updatedAt: timestamp,
      };
      await this.repository.save(updated);
      return {
        ok: true,
        data: { designId, currentRevisionId: snapshot.id, snapshot },
        correlationId: actor.correlationId,
        currentRevisionId: snapshot.id,
      };
    } catch {
      return this.internalFailure(actor);
    }
  }

  private validateDocument(
    actor: ActorContext,
    document: DesignDocument,
  ): ApplicationFailure | null {
    const validation = validateDesignDocument(document);
    if (validation.ok) return null;
    const unsupported = validation.errors.some(
      (issue) => issue.code === "unsupported-schema-version",
    );
    return {
      ok: false,
      error: {
        code: unsupported ? "unsupported-schema-version" : "invalid-operation",
        message: unsupported
          ? "The Design document schema is not supported."
          : "The Design document is invalid.",
        recoveryHint: unsupported
          ? "Migrate the document to the supported schema before retrying."
          : "Correct the reported domain issues and retry the request.",
        issues: validation.errors,
      },
      correlationId: actor.correlationId,
    };
  }

  private internalFailure(
    actor: ActorContext,
    currentRevisionId?: string,
  ): ApplicationFailure {
    return {
      ok: false,
      error: {
        code: "internal-failure",
        message: "The Design operation could not be completed.",
        recoveryHint: "Retry with the same correlation ID or contact an administrator.",
      },
      correlationId: actor.correlationId,
      currentRevisionId,
    };
  }
}
