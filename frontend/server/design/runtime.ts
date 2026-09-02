import { createCommercePlatformFixture } from "@/domain/design";
import { DesignService } from "@/server/design/DesignService";
import { InMemoryActorDirectory } from "@/server/auth/InMemoryActorDirectory";
import { TypeOrmActorDirectory } from "@/server/auth/TypeOrmActorDirectory";
import type { ActorDirectory } from "@/server/auth/ActorDirectory";
import { InMemoryDesignRepository } from "@/server/design/repositories/InMemoryDesignRepository";
import { TypeOrmDesignRepository } from "@/server/design/repositories/TypeOrmDesignRepository";
import type { DesignRepository } from "@/server/design/repositories/DesignRepository";
import type { DesignRecord } from "@/server/design/models";
import { getOpenWorkBoardDataSource } from "@/server/persistence/dataSource";

const FIXTURE_TIME = "2026-08-31T00:00:00.000Z";

const fixtureRecord = (): DesignRecord => {
  const document = createCommercePlatformFixture();
  return {
    id: document.id,
    workspaceId: "workspace-acme",
    currentSnapshotId: "revision-commerce-v1",
    snapshots: [
      {
        id: "revision-commerce-v1",
        designId: document.id,
        kind: "initial",
        document,
        createdAt: FIXTURE_TIME,
        createdByActorId: "actor-fixture-author",
      },
    ],
    createdAt: FIXTURE_TIME,
    updatedAt: FIXTURE_TIME,
  };
};

export type DesignRuntime = {
  repository: DesignRepository;
  actorDirectory: ActorDirectory;
  service: DesignService;
};

export const createDesignRuntime = (seedFixture = true): DesignRuntime => {
  const repository = new InMemoryDesignRepository(seedFixture ? [fixtureRecord()] : []);
  const actorDirectory = new InMemoryActorDirectory([
    {
      actorId: "actor-local-designer",
      workspaceId: "workspace-acme",
      role: "owner",
    },
    {
      actorId: "actor-contract",
      workspaceId: "workspace-acme",
      role: "owner",
    },
  ]);
  return {
    repository,
    actorDirectory,
    service: new DesignService(repository),
  };
};

const runtimeGlobal = globalThis as typeof globalThis & {
  openWorkBoardRuntime?: Promise<DesignRuntime>;
};

const createConfiguredRuntime = async (): Promise<DesignRuntime> => {
  if (process.env.DATABASE_URL) {
    const dataSource = await getOpenWorkBoardDataSource();
    const repository = new TypeOrmDesignRepository(dataSource);
    return {
      repository,
      actorDirectory: new TypeOrmActorDirectory(dataSource),
      service: new DesignService(repository),
    };
  }
  const inMemoryAllowed =
    process.env.OPEN_WORKBOARD_USE_IN_MEMORY === "true" ||
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test";
  if (!inMemoryAllowed) {
    throw new Error(
      "DATABASE_URL is required unless OPEN_WORKBOARD_USE_IN_MEMORY=true is explicitly configured.",
    );
  }
  return createDesignRuntime();
};

export const getDesignRuntime = () => {
  runtimeGlobal.openWorkBoardRuntime ??= createConfiguredRuntime();
  return runtimeGlobal.openWorkBoardRuntime;
};
