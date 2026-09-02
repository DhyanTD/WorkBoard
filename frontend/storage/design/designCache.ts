import Dexie, { type EntityTable } from "dexie";
import type { DesignDocument } from "@/domain/design";

export type CachedDesign = {
  key: string;
  designId: string;
  workspaceId: string;
  document: DesignDocument;
  currentRevisionId: string;
  state: "server-confirmed" | "offline-draft";
  updatedAt: string;
};

export type LegacyImportReceipt = {
  fingerprint: string;
  source: "open-workboard-v1";
  designId: string;
  workspaceId: string;
  revisionId: string;
  confirmedAt: string;
};

class DesignCacheDatabase extends Dexie {
  designs!: EntityTable<CachedDesign, "key">;
  legacyImports!: EntityTable<LegacyImportReceipt, "fingerprint">;

  constructor() {
    super("open-workboard-design-cache");
    this.version(1).stores({
      designs: "key, designId, workspaceId, updatedAt, state",
      legacyImports: "fingerprint, workspaceId, designId, confirmedAt",
    });
  }
}

const database = new DesignCacheDatabase();
const cacheKey = (workspaceId: string, designId: string) =>
  `${workspaceId}:${designId}`;

export const designCache = {
  async get(workspaceId: string, designId: string) {
    return database.designs.get(cacheKey(workspaceId, designId));
  },

  async saveConfirmed(
    workspaceId: string,
    document: DesignDocument,
    currentRevisionId: string,
  ) {
    await database.designs.put({
      key: cacheKey(workspaceId, document.id),
      workspaceId,
      designId: document.id,
      document: structuredClone(document),
      currentRevisionId,
      state: "server-confirmed",
      updatedAt: new Date().toISOString(),
    });
  },

  async saveOffline(
    workspaceId: string,
    document: DesignDocument,
    currentRevisionId: string,
  ) {
    await database.designs.put({
      key: cacheKey(workspaceId, document.id),
      workspaceId,
      designId: document.id,
      document: structuredClone(document),
      currentRevisionId,
      state: "offline-draft",
      updatedAt: new Date().toISOString(),
    });
  },

  async confirmLegacyImport(receipt: LegacyImportReceipt) {
    await database.legacyImports.put(structuredClone(receipt));
  },

  async getLegacyImport(fingerprint: string) {
    return database.legacyImports.get(fingerprint);
  },

  async clearForTests() {
    await database.transaction("rw", database.designs, database.legacyImports, async () => {
      await database.designs.clear();
      await database.legacyImports.clear();
    });
  },
};

export const fingerprintPayload = async (payload: string) => {
  const bytes = new TextEncoder().encode(payload);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};
