import type { DesignDocument, DomainIssue } from "@/domain/design";

export type ActorRole = "owner" | "editor" | "viewer";
export type ActorScope = "design:read" | "design:write";

export type ActorContext = {
  actorId: string;
  workspaceId: string;
  roles: ActorRole[];
  scopes: ActorScope[];
  correlationId: string;
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
  | "not-found"
  | "forbidden"
  | "conflict"
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
