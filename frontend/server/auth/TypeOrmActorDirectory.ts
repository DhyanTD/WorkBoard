import type { DataSource } from "typeorm";
import type { ActorDirectory } from "@/server/auth/ActorDirectory";
import type { ActorRole } from "@/server/design/models";
import {
  ExternalIdentitySchema,
  WorkspaceMembershipSchema,
  WorkspaceSchema,
} from "@/server/persistence/entities";

const isActorRole = (value: string): value is ActorRole =>
  value === "owner" || value === "editor" || value === "viewer";

export class TypeOrmActorDirectory implements ActorDirectory {
  constructor(private readonly dataSource: DataSource) {}

  async resolveWorkOs(workosUserId: string, workosOrganizationId: string) {
    return this.dataSource.transaction(async (manager) => {
      const identity = await manager.getRepository(ExternalIdentitySchema).findOne({
        where: { provider: "workos", providerSubjectId: workosUserId },
      });
      const workspace = await manager.getRepository(WorkspaceSchema).findOne({
        where: { workosOrganizationId },
      });
      if (!identity || !workspace) return null;
      const membership = await manager
        .getRepository(WorkspaceMembershipSchema)
        .findOne({
          where: {
            workspaceId: workspace.id,
            principalId: identity.principalId,
            status: "active",
          },
        });
      if (!membership || !isActorRole(membership.role)) return null;
      return {
        actorId: identity.principalId,
        workspaceId: workspace.id,
        role: membership.role,
      };
    });
  }

  async resolveDevelopment(actorId: string, workspaceId: string) {
    const membership = await this.dataSource
      .getRepository(WorkspaceMembershipSchema)
      .findOne({
        where: { workspaceId, principalId: actorId, status: "active" },
      });
    if (!membership || !isActorRole(membership.role)) return null;
    return { actorId, workspaceId, role: membership.role };
  }
}
