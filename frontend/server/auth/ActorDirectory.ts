import type { ActorRole, ActorScope } from "@/server/design/models";

export type DirectoryActor = {
  actorId: string;
  workspaceId: string;
  role: ActorRole;
};

export interface ActorDirectory {
  resolveWorkOs(
    workosUserId: string,
    workosOrganizationId: string,
  ): Promise<DirectoryActor | null>;
  resolveDevelopment(
    actorId: string,
    workspaceId: string,
  ): Promise<DirectoryActor | null>;
}

export const roleScopes = (role: ActorRole): ActorScope[] =>
  role === "viewer" ? ["design:read"] : ["design:read", "design:write"];
