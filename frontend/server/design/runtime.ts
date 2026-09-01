import { createCommercePlatformFixture } from "@/domain/design";
import { DesignService } from "@/server/design/DesignService";
import { InMemoryDesignRepository } from "@/server/design/repositories/InMemoryDesignRepository";
import type { DesignRecord } from "@/server/design/models";

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

export const createDesignRuntime = (seedFixture = true) => {
  const repository = new InMemoryDesignRepository(seedFixture ? [fixtureRecord()] : []);
  return {
    repository,
    service: new DesignService(repository),
  };
};

const runtime = createDesignRuntime();

export const getDesignRuntime = () => runtime;
