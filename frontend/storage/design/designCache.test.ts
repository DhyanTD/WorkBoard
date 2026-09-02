// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { createCommercePlatformFixture } from "@/domain/design";
import { designCache, fingerprintPayload } from "@/storage/design/designCache";

describe("designCache", () => {
  beforeEach(async () => {
    await designCache.clearForTests();
  });

  it("keeps server-confirmed and offline Design state scoped by Workspace", async () => {
    const document = createCommercePlatformFixture();
    await designCache.saveConfirmed("workspace-a", document, "revision-1");
    await designCache.saveOffline(
      "workspace-a",
      { ...document, metadata: { ...document.metadata, name: "Offline edit" } },
      "revision-1",
    );

    expect(await designCache.get("workspace-b", document.id)).toBeUndefined();
    expect(await designCache.get("workspace-a", document.id)).toMatchObject({
      state: "offline-draft",
      currentRevisionId: "revision-1",
      document: { metadata: { name: "Offline edit" } },
    });
  });

  it("records an import only after a confirmed server result", async () => {
    const fingerprint = await fingerprintPayload("legacy-source");
    expect(await designCache.getLegacyImport(fingerprint)).toBeUndefined();
    await designCache.confirmLegacyImport({
      fingerprint,
      source: "open-workboard-v1",
      workspaceId: "workspace-acme",
      designId: "design-imported",
      revisionId: "revision-imported",
      confirmedAt: "2026-09-02T12:00:00.000Z",
    });
    expect(await designCache.getLegacyImport(fingerprint)).toMatchObject({
      designId: "design-imported",
      revisionId: "revision-imported",
    });
  });
});
