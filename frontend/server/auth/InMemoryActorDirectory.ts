import type { ActorDirectory, DirectoryActor } from "@/server/auth/ActorDirectory";

export type InMemoryDirectoryEntry = DirectoryActor & {
  workosUserId?: string;
  workosOrganizationId?: string;
};

export class InMemoryActorDirectory implements ActorDirectory {
  constructor(private readonly entries: InMemoryDirectoryEntry[]) {}

  async resolveWorkOs(workosUserId: string, workosOrganizationId: string) {
    const entry = this.entries.find(
      (candidate) =>
        candidate.workosUserId === workosUserId &&
        candidate.workosOrganizationId === workosOrganizationId,
    );
    return entry ? this.toActor(entry) : null;
  }

  async resolveDevelopment(actorId: string, workspaceId: string) {
    const entry = this.entries.find(
      (candidate) =>
        candidate.actorId === actorId && candidate.workspaceId === workspaceId,
    );
    return entry ? this.toActor(entry) : null;
  }

  private toActor(entry: InMemoryDirectoryEntry): DirectoryActor {
    return {
      actorId: entry.actorId,
      workspaceId: entry.workspaceId,
      role: entry.role,
    };
  }
}
