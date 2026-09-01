import { describe, expect, it } from "vitest";
import {
  createCommercePlatformFixture,
  type DesignOperation,
} from "@/domain/design";
import { DesignService } from "@/server/design/DesignService";
import type { ActorContext } from "@/server/design/models";
import { InMemoryDesignRepository } from "@/server/design/repositories/InMemoryDesignRepository";

const owner: ActorContext = {
  actorId: "actor-owner",
  workspaceId: "workspace-acme",
  roles: ["owner"],
  scopes: ["design:read", "design:write"],
  correlationId: "request-owner",
};

const viewer: ActorContext = {
  actorId: "actor-viewer",
  workspaceId: "workspace-acme",
  roles: ["viewer"],
  scopes: ["design:read"],
  correlationId: "request-viewer",
};

const createService = () => {
  let sequence = 0;
  return new DesignService(new InMemoryDesignRepository(), {
    now: () => "2026-08-31T12:00:00.000Z",
    createId: (prefix) => `${prefix}-test-${sequence++}`,
  });
};

describe("DesignService", () => {
  it("creates, lists, reads, and validates a fixture", async () => {
    const service = createService();
    const document = createCommercePlatformFixture();
    const created = await service.createDesign(owner, document);
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error(created.error.message);

    const listed = await service.listDesigns(owner);
    const head = await service.getDesignHead(owner, document.id);
    const snapshot = await service.getSnapshot(
      owner,
      document.id,
      created.data.currentRevisionId,
    );
    const operations: DesignOperation[] = [
      {
        kind: "update-design-metadata",
        metadata: { ...document.metadata, name: "Commerce Platform review" },
      },
    ];
    const validation = await service.validateOperations(owner, document.id, operations);

    expect(listed.ok && listed.data[0]?.id).toBe(document.id);
    expect(head.ok && head.data.snapshot.document).toEqual(document);
    expect(snapshot.ok && snapshot.data.document).toEqual(document);
    expect(validation.ok && validation.data.valid).toBe(true);
    expect(
      validation.ok && validation.data.candidateDocument?.metadata.name,
    ).toBe("Commerce Platform review");
  });

  it("enforces write authorization inside the application boundary", async () => {
    const service = createService();
    const result = await service.createDesign(viewer, createCommercePlatformFixture());

    expect(result).toMatchObject({
      ok: false,
      error: { code: "forbidden" },
      correlationId: viewer.correlationId,
    });
  });

  it("rejects a stale expected revision and returns the current revision", async () => {
    const service = createService();
    const document = createCommercePlatformFixture();
    const created = await service.createDesign(owner, document);
    if (!created.ok) throw new Error(created.error.message);
    const saved = await service.saveDraft(
      owner,
      document.id,
      { ...document, metadata: { ...document.metadata, name: "Draft one" } },
      created.data.currentRevisionId,
    );
    if (!saved.ok) throw new Error(saved.error.message);

    const conflict = await service.saveDraft(
      owner,
      document.id,
      document,
      created.data.currentRevisionId,
    );
    expect(conflict).toMatchObject({
      ok: false,
      error: { code: "conflict" },
      currentRevisionId: saved.data.currentRevisionId,
    });
  });
});
