import { EntitySchema } from "typeorm";
import type { DesignDocument } from "@/domain/design";
import type {
  ActorRole,
  AuthenticationMethod,
  DesignOperationName,
  DesignSnapshotKind,
} from "@/server/design/models";

export type WorkspaceEntity = {
  id: string;
  name: string;
  workosOrganizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PrincipalEntity = {
  id: string;
  kind: "human" | "agent" | "service";
  displayName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ExternalIdentityEntity = {
  id: string;
  provider: "workos";
  providerSubjectId: string;
  principalId: string;
  createdAt: Date;
};

export type WorkspaceMembershipEntity = {
  id: string;
  workspaceId: string;
  principalId: string;
  role: ActorRole;
  status: "active" | "revoked";
  createdAt: Date;
  updatedAt: Date;
};

export type DesignEntity = {
  id: string;
  workspaceId: string;
  name: string;
  headRevisionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DesignRevisionEntity = {
  id: string;
  designId: string;
  kind: DesignSnapshotKind;
  document: DesignDocument;
  createdAt: Date;
  createdByActorId: string;
};

export type IdempotencyEntity = {
  id: string;
  workspaceId: string;
  actorId: string;
  operation: DesignOperationName;
  idempotencyKey: string;
  requestFingerprint: string;
  resultDesignId: string;
  resultRevisionId: string;
  expiresAt: Date;
  createdAt: Date;
};

export type AuditEventEntity = {
  id: string;
  workspaceId: string;
  actorId: string;
  correlationId: string;
  authenticationMethod: AuthenticationMethod;
  action: string;
  resourceType: "workspace" | "design" | "revision";
  resourceId: string;
  resultId: string | null;
  outcome: "success" | "denied" | "failure";
  createdAt: Date;
};

const createdAt = { type: "timestamptz" as const, createDate: true };
const updatedAt = { type: "timestamptz" as const, updateDate: true };

export const WorkspaceSchema = new EntitySchema<WorkspaceEntity>({
  name: "Workspace",
  tableName: "workspaces",
  columns: {
    id: { type: "varchar", length: 160, primary: true },
    name: { type: "varchar", length: 240 },
    workosOrganizationId: { type: "varchar", length: 160, unique: true },
    createdAt,
    updatedAt,
  },
});

export const PrincipalSchema = new EntitySchema<PrincipalEntity>({
  name: "Principal",
  tableName: "principals",
  columns: {
    id: { type: "varchar", length: 160, primary: true },
    kind: { type: "varchar", length: 24 },
    displayName: { type: "varchar", length: 240, nullable: true },
    createdAt,
    updatedAt,
  },
});

export const ExternalIdentitySchema = new EntitySchema<ExternalIdentityEntity>({
  name: "ExternalIdentity",
  tableName: "external_identities",
  columns: {
    id: { type: "varchar", length: 160, primary: true },
    provider: { type: "varchar", length: 32 },
    providerSubjectId: { type: "varchar", length: 200 },
    principalId: { type: "varchar", length: 160 },
    createdAt,
  },
  uniques: [
    { name: "uq_external_identity_provider_subject", columns: ["provider", "providerSubjectId"] },
  ],
  indices: [{ name: "idx_external_identity_principal", columns: ["principalId"] }],
  foreignKeys: [
    {
      name: "fk_external_identity_principal",
      target: "Principal",
      columnNames: ["principalId"],
      referencedColumnNames: ["id"],
      onDelete: "CASCADE",
    },
  ],
});

export const WorkspaceMembershipSchema =
  new EntitySchema<WorkspaceMembershipEntity>({
    name: "WorkspaceMembership",
    tableName: "workspace_memberships",
    columns: {
      id: { type: "varchar", length: 160, primary: true },
      workspaceId: { type: "varchar", length: 160 },
      principalId: { type: "varchar", length: 160 },
      role: { type: "varchar", length: 24 },
      status: { type: "varchar", length: 24 },
      createdAt,
      updatedAt,
    },
    uniques: [
      { name: "uq_workspace_membership_principal", columns: ["workspaceId", "principalId"] },
    ],
    indices: [
      { name: "idx_workspace_membership_active", columns: ["workspaceId", "status"] },
    ],
    foreignKeys: [
      {
        name: "fk_membership_workspace",
        target: "Workspace",
        columnNames: ["workspaceId"],
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      },
      {
        name: "fk_membership_principal",
        target: "Principal",
        columnNames: ["principalId"],
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      },
    ],
  });

export const DesignSchema = new EntitySchema<DesignEntity>({
  name: "Design",
  tableName: "designs",
  columns: {
    id: { type: "varchar", length: 160, primary: true },
    workspaceId: { type: "varchar", length: 160 },
    name: { type: "varchar", length: 240 },
    headRevisionId: { type: "varchar", length: 160, nullable: true },
    createdAt,
    updatedAt,
  },
  indices: [
    { name: "idx_design_workspace_updated", columns: ["workspaceId", "updatedAt"] },
  ],
  foreignKeys: [
    {
      name: "fk_design_workspace",
      target: "Workspace",
      columnNames: ["workspaceId"],
      referencedColumnNames: ["id"],
      onDelete: "CASCADE",
    },
    {
      name: "fk_design_head_revision",
      target: "DesignRevision",
      columnNames: ["headRevisionId"],
      referencedColumnNames: ["id"],
      onDelete: "RESTRICT",
    },
  ],
});

export const DesignRevisionSchema = new EntitySchema<DesignRevisionEntity>({
  name: "DesignRevision",
  tableName: "design_revisions",
  columns: {
    id: { type: "varchar", length: 160, primary: true },
    designId: { type: "varchar", length: 160 },
    kind: { type: "varchar", length: 24 },
    document: { type: "jsonb" },
    createdAt,
    createdByActorId: { type: "varchar", length: 160 },
  },
  indices: [
    { name: "idx_design_revision_design_created", columns: ["designId", "createdAt"] },
  ],
  foreignKeys: [
    {
      name: "fk_design_revision_design",
      target: "Design",
      columnNames: ["designId"],
      referencedColumnNames: ["id"],
      onDelete: "CASCADE",
    },
    {
      name: "fk_design_revision_actor",
      target: "Principal",
      columnNames: ["createdByActorId"],
      referencedColumnNames: ["id"],
      onDelete: "RESTRICT",
    },
  ],
});

export const IdempotencySchema = new EntitySchema<IdempotencyEntity>({
  name: "IdempotencyRecord",
  tableName: "idempotency_records",
  columns: {
    id: { type: "varchar", length: 160, primary: true },
    workspaceId: { type: "varchar", length: 160 },
    actorId: { type: "varchar", length: 160 },
    operation: { type: "varchar", length: 80 },
    idempotencyKey: { type: "varchar", length: 200 },
    requestFingerprint: { type: "varchar", length: 64 },
    resultDesignId: { type: "varchar", length: 160 },
    resultRevisionId: { type: "varchar", length: 160 },
    expiresAt: { type: "timestamptz" },
    createdAt,
  },
  uniques: [
    {
      name: "uq_idempotency_actor_operation_key",
      columns: ["workspaceId", "actorId", "operation", "idempotencyKey"],
    },
  ],
  indices: [{ name: "idx_idempotency_expiry", columns: ["expiresAt"] }],
  foreignKeys: [
    {
      name: "fk_idempotency_workspace",
      target: "Workspace",
      columnNames: ["workspaceId"],
      referencedColumnNames: ["id"],
      onDelete: "CASCADE",
    },
    {
      name: "fk_idempotency_actor",
      target: "Principal",
      columnNames: ["actorId"],
      referencedColumnNames: ["id"],
      onDelete: "CASCADE",
    },
    {
      name: "fk_idempotency_result_design",
      target: "Design",
      columnNames: ["resultDesignId"],
      referencedColumnNames: ["id"],
      onDelete: "CASCADE",
    },
    {
      name: "fk_idempotency_result_revision",
      target: "DesignRevision",
      columnNames: ["resultRevisionId"],
      referencedColumnNames: ["id"],
      onDelete: "CASCADE",
    },
  ],
});

export const AuditEventSchema = new EntitySchema<AuditEventEntity>({
  name: "AuditEvent",
  tableName: "audit_events",
  columns: {
    id: { type: "varchar", length: 160, primary: true },
    workspaceId: { type: "varchar", length: 160 },
    actorId: { type: "varchar", length: 160 },
    correlationId: { type: "varchar", length: 160 },
    authenticationMethod: { type: "varchar", length: 40 },
    action: { type: "varchar", length: 120 },
    resourceType: { type: "varchar", length: 32 },
    resourceId: { type: "varchar", length: 160 },
    resultId: { type: "varchar", length: 160, nullable: true },
    outcome: { type: "varchar", length: 24 },
    createdAt,
  },
  indices: [
    { name: "idx_audit_workspace_created", columns: ["workspaceId", "createdAt"] },
    { name: "idx_audit_resource", columns: ["resourceType", "resourceId"] },
    { name: "idx_audit_correlation", columns: ["correlationId"] },
  ],
  foreignKeys: [
    {
      name: "fk_audit_workspace",
      target: "Workspace",
      columnNames: ["workspaceId"],
      referencedColumnNames: ["id"],
      onDelete: "RESTRICT",
    },
    {
      name: "fk_audit_actor",
      target: "Principal",
      columnNames: ["actorId"],
      referencedColumnNames: ["id"],
      onDelete: "RESTRICT",
    },
  ],
});

export const openWorkBoardEntities = [
  WorkspaceSchema,
  PrincipalSchema,
  ExternalIdentitySchema,
  WorkspaceMembershipSchema,
  DesignSchema,
  DesignRevisionSchema,
  IdempotencySchema,
  AuditEventSchema,
];
