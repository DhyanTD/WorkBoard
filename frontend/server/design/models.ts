import type { DesignDocument, DomainIssue } from "@/domain/design";

export type ActorRole = "owner" | "editor" | "viewer";
export type ActorScope = "design:read" | "design:write";
export type AuthenticationMethod =
  | "workos-session"
  | "workos-access-token"
  | "development";

export type ActorContext = {
  actorId: string;
  workspaceId: string;
  roles: ActorRole[];
  scopes: ActorScope[];
  correlationId: string;
  authenticationMethod: AuthenticationMethod;
  sessionId?: string;
};

export type DesignSnapshotKind = "initial" | "draft";

export type DesignSnapshot = {
  id: string;
  designId: string;
  kind: DesignSnapshotKind;
  document: DesignDocument;
  createdAt: string;
  createdByActorId: string;
};

export type DesignRecord = {
  id: string;
  workspaceId: string;
  currentSnapshotId: string;
  snapshots: DesignSnapshot[];
  createdAt: string;
  updatedAt: string;
};

export type DesignSummary = {
  id: string;
  workspaceId: string;
  name: string;
  currentRevisionId: string;
  updatedAt: string;
};

export type DesignHead = {
  designId: string;
  workspaceId: string;
  currentRevisionId: string;
  snapshot: DesignSnapshot;
};

export type OperationValidation = {
  valid: boolean;
  currentRevisionId: string;
  candidateDocument?: DesignDocument;
  issues: DomainIssue[];
};

export type ApplicationErrorCode =
  | "unauthenticated"
  | "not-found"
  | "forbidden"
  | "conflict"
  | "idempotency-conflict"
  | "invalid-operation"
  | "unsupported-schema-version"
  | "internal-failure";

export type ApplicationError = {
  code: ApplicationErrorCode;
  message: string;
  recoveryHint: string;
  issues?: DomainIssue[];
};

export type ApplicationSuccess<T> = {
  ok: true;
  data: T;
  correlationId: string;
  currentRevisionId?: string;
};

export type ApplicationFailure = {
  ok: false;
  error: ApplicationError;
  correlationId: string;
  currentRevisionId?: string;
};

export type ApplicationResult<T> = ApplicationSuccess<T> | ApplicationFailure;

export type DesignOperationName = "design.create" | "design.save-draft";

export type PersistenceContext = {
  actorId: string;
  workspaceId: string;
  correlationId: string;
  authenticationMethod: AuthenticationMethod;
};

export type WriteCommand = PersistenceContext & {
  operation: DesignOperationName;
  requestFingerprint: string;
  idempotencyKey?: string;
  idempotencyExpiresAt: string;
};

export type AuditOutcome = "success" | "denied" | "failure";

export type AuditEvent = PersistenceContext & {
  id: string;
  action: string;
  resourceType: "workspace" | "design" | "revision";
  resourceId: string;
  resultId?: string;
  outcome: AuditOutcome;
  createdAt: string;
};

export type DesignWriteResult =
  | { status: "applied" | "replayed"; record: DesignRecord }
  | { status: "duplicate" }
  | { status: "not-found" }
  | { status: "idempotency-conflict" }
  | { status: "revision-conflict"; currentRevisionId: string };
