import {
  applyDesignOperations,
  createProductionId,
  validateDesignDocument,
  type DesignDocument,
  type DesignOperation,
} from "@/domain/design";
import { createHash } from "node:crypto";
import { authorizeRead, authorizeWrite } from "@/server/design/authorization";
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
  PersistenceContext,
  WriteCommand,
} from "@/server/design/models";

type ServiceOptions = {
  createId?: (prefix: string) => string;
  now?: () => string;
};

export type WriteOptions = {
  idempotencyKey?: string;
};

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

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

const persistenceContext = (actor: ActorContext): PersistenceContext => ({
  actorId: actor.actorId,
  workspaceId: actor.workspaceId,
  correlationId: actor.correlationId,
  authenticationMethod: actor.authenticationMethod,
});

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
    if (denied) return this.denied(actor, denied, "design.list", actor.workspaceId);
    try {
      const records = await this.repository.listByWorkspace(persistenceContext(actor));
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
    options: WriteOptions = {},
  ): Promise<ApplicationResult<DesignHead>> {
    const denied = authorizeWrite(actor);
    if (denied) return this.denied(actor, denied, "design.create", document.id);
    const validationFailure = this.validateDocument(actor, document);
    if (validationFailure) return validationFailure;
    try {
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
      const written = await this.repository.create(
        record,
        this.writeCommand(actor, "design.create", document, options, timestamp),
      );
      if (written.status === "duplicate") {
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
      if (written.status === "idempotency-conflict") {
        return this.idempotencyConflict(actor);
      }
      if (written.status !== "applied" && written.status !== "replayed") {
        return this.internalFailure(actor);
      }
      const persistedSnapshot = currentSnapshot(written.record);
      if (!persistedSnapshot) return this.internalFailure(actor);
      return {
        ok: true,
        data: {
          designId: written.record.id,
          workspaceId: written.record.workspaceId,
          currentRevisionId: persistedSnapshot.id,
          snapshot: persistedSnapshot,
        },
        correlationId: actor.correlationId,
        currentRevisionId: persistedSnapshot.id,
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
    if (denied) return this.denied(actor, denied, "design.read", designId);
    try {
      const record = await this.repository.findById(persistenceContext(actor), designId);
      if (!record) return notFound(actor, designId);
      const snapshot = currentSnapshot(record);
      if (!snapshot) return this.internalFailure(actor, record.currentSnapshotId);
      return {
        ok: true,
        data: {
          designId,
          workspaceId: record.workspaceId,
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
    if (denied) return this.denied(actor, denied, "revision.read", revisionId);
    try {
      const found = await this.repository.findSnapshot(
        persistenceContext(actor),
        designId,
        revisionId,
      );
      if (!found) return notFound(actor, `${designId}/revisions/${revisionId}`);
      return {
        ok: true,
        data: found.snapshot,
        correlationId: actor.correlationId,
        currentRevisionId: found.record.currentSnapshotId,
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
    options: WriteOptions = {},
  ): Promise<ApplicationResult<DesignHead>> {
    const denied = authorizeWrite(actor);
    if (denied) return this.denied(actor, denied, "design.save-draft", designId);
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
      const timestamp = this.now();
      const snapshot: DesignSnapshot = {
        id: this.createId("draft"),
        designId,
        kind: "draft",
        document: structuredClone(document),
        createdAt: timestamp,
        createdByActorId: actor.actorId,
      };
      const written = await this.repository.appendDraft(
        designId,
        snapshot,
        expectedRevisionId,
        this.writeCommand(
          actor,
          "design.save-draft",
          { document, expectedRevisionId },
          options,
          timestamp,
        ),
      );
      if (written.status === "not-found") return notFound(actor, designId);
      if (written.status === "idempotency-conflict") {
        return this.idempotencyConflict(actor);
      }
      if (written.status === "revision-conflict") {
        return {
          ok: false,
          error: {
            code: "conflict",
            message: "The Design changed after this draft was loaded.",
            recoveryHint: "Refetch the current snapshot before saving again.",
          },
          correlationId: actor.correlationId,
          currentRevisionId: written.currentRevisionId,
        };
      }
      if (written.status !== "applied" && written.status !== "replayed") {
        return this.internalFailure(actor);
      }
      const persistedSnapshot = currentSnapshot(written.record);
      if (!persistedSnapshot) return this.internalFailure(actor);
      return {
        ok: true,
        data: {
          designId,
          workspaceId: written.record.workspaceId,
          currentRevisionId: persistedSnapshot.id,
          snapshot: persistedSnapshot,
        },
        correlationId: actor.correlationId,
        currentRevisionId: persistedSnapshot.id,
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

  private writeCommand(
    actor: ActorContext,
    operation: WriteCommand["operation"],
    request: DesignDocument | { document: DesignDocument; expectedRevisionId: string },
    options: WriteOptions,
    timestamp: string,
  ): WriteCommand {
    return {
      ...persistenceContext(actor),
      operation,
      idempotencyKey: options.idempotencyKey,
      requestFingerprint: createHash("sha256")
        .update(JSON.stringify(request))
        .digest("hex"),
      idempotencyExpiresAt: new Date(
        new Date(timestamp).getTime() + IDEMPOTENCY_TTL_MS,
      ).toISOString(),
    };
  }

  private idempotencyConflict(actor: ActorContext): ApplicationFailure {
    return {
      ok: false,
      error: {
        code: "idempotency-conflict",
        message: "The idempotency key was already used for a different request.",
        recoveryHint: "Reuse a key only for byte-equivalent intent, or send a new key.",
      },
      correlationId: actor.correlationId,
    };
  }

  private async denied(
    actor: ActorContext,
    failure: ApplicationFailure,
    action: string,
    resourceId: string,
  ): Promise<ApplicationFailure> {
    try {
      await this.repository.recordDenied({
        ...persistenceContext(actor),
        id: this.createId("audit"),
        action,
        resourceType: resourceId === actor.workspaceId ? "workspace" : "design",
        resourceId,
        outcome: "denied",
        createdAt: this.now(),
      });
    } catch {
      return this.internalFailure(actor);
    }
    return failure;
  }
}
