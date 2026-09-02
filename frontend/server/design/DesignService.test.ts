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
  authenticationMethod: "development",
};

const viewer: ActorContext = {
  actorId: "actor-viewer",
  workspaceId: "workspace-acme",
  roles: ["viewer"],
  scopes: ["design:read"],
  correlationId: "request-viewer",
  authenticationMethod: "development",
};

const otherWorkspaceOwner: ActorContext = {
  ...owner,
  actorId: "actor-other-owner",
  workspaceId: "workspace-other",
  correlationId: "request-other-owner",
};

const createService = () => {
  let sequence = 0;
  return new DesignService(new InMemoryDesignRepository(), {
    now: () => "2026-09-02T12:00:00.000Z",
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

  it("does not enumerate or read Designs from another Workspace", async () => {
    const service = createService();
    const document = createCommercePlatformFixture();
    const created = await service.createDesign(owner, document);
    expect(created.ok).toBe(true);

    const listed = await service.listDesigns(otherWorkspaceOwner);
    const read = await service.getDesignHead(otherWorkspaceOwner, document.id);

    expect(listed.ok && listed.data).toEqual([]);
    expect(read).toMatchObject({ ok: false, error: { code: "not-found" } });
  });

  it("replays equivalent idempotent writes and rejects key reuse for new intent", async () => {
    const service = createService();
    const document = createCommercePlatformFixture();
    const first = await service.createDesign(owner, document, {
      idempotencyKey: "create-commerce",
    });
    const replay = await service.createDesign(owner, document, {
      idempotencyKey: "create-commerce",
    });
    const changed = await service.createDesign(
      owner,
      { ...document, metadata: { ...document.metadata, name: "Different intent" } },
      { idempotencyKey: "create-commerce" },
    );

    expect(first.ok && replay.ok && replay.data).toEqual(first.ok && first.data);
    expect(changed).toMatchObject({
      ok: false,
      error: { code: "idempotency-conflict" },
    });
  });

  it("does not expose an invalid head when a transactional write fails", async () => {
    const repository = new InMemoryDesignRepository();
    const service = new DesignService(repository, {
      now: () => "2026-09-02T12:00:00.000Z",
      createId: (prefix) => `${prefix}-rollback`,
    });
    repository.injectFailureBeforeCommit();

    const failed = await service.createDesign(owner, createCommercePlatformFixture());
    const read = await service.getDesignHead(owner, createCommercePlatformFixture().id);

    expect(failed).toMatchObject({ ok: false, error: { code: "internal-failure" } });
    expect(read).toMatchObject({ ok: false, error: { code: "not-found" } });
  });

  it("records correlation and result references without request content", async () => {
    const repository = new InMemoryDesignRepository();
    const service = new DesignService(repository, {
      now: () => "2026-09-02T12:00:00.000Z",
      createId: (prefix) => `${prefix}-audit`,
    });
    const document = createCommercePlatformFixture();
    const created = await service.createDesign(owner, document);
    if (!created.ok) throw new Error(created.error.message);

    const audit = repository.getAuditEvents();
    expect(audit).toContainEqual(
      expect.objectContaining({
        correlationId: owner.correlationId,
        action: "design.create",
        resultId: created.data.currentRevisionId,
      }),
    );
    expect(JSON.stringify(audit)).not.toContain(document.metadata.description);
    expect(JSON.stringify(audit)).not.toContain("authorization");
  });
});
