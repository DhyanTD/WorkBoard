import "fake-indexeddb/auto";

import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageValue } from "zustand/middleware";
import type { PersistedBoardState } from "@/storage/board/types";
import {
  BOARD_STORAGE_V1_LEGACY_JSON,
  BOARD_STORAGE_V1_STATE,
  BOARD_STORAGE_V1_VALUE,
} from "@/storage/board/fixtures/boardStorageV1.fixture";

const DATABASE_NAME = "open-workboard";
const STORAGE_KEY = "open-workboard-board";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const deleteDatabase = async () => {
  await Dexie.delete(DATABASE_NAME);
};

const createDeferred = () => {
  let resolvePromise: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
};

beforeEach(async () => {
  vi.resetModules();
  vi.doUnmock("@/storage/board/database");
  vi.stubGlobal("localStorage", new MemoryStorage());
  await deleteDatabase();
});

afterEach(async () => {
  vi.doUnmock("@/storage/board/database");
  await deleteDatabase();
});

describe("boardIndexedDbStorage version 1 contract", () => {
  it("uses the named version-1 database and returns its singleton record", async () => {
    const { getWorkboardDatabase, WORKBOARD_DATABASE_NAME } = await import(
      "@/storage/board/database"
    );
    const { boardIndexedDbStorage } = await import(
      "@/storage/board/boardStorage"
    );
    const database = getWorkboardDatabase();

    expect(WORKBOARD_DATABASE_NAME).toBe(DATABASE_NAME);
    expect(database.verno).toBe(1);

    await database.boards.put({
      id: STORAGE_KEY,
      ...BOARD_STORAGE_V1_VALUE,
      updatedAt: 1_725_062_400_000,
    });

    await expect(boardIndexedDbStorage.getItem(STORAGE_KEY)).resolves.toEqual(
      BOARD_STORAGE_V1_VALUE,
    );
  });

  it("imports a valid legacy record only when IndexedDB is empty", async () => {
    localStorage.setItem(STORAGE_KEY, BOARD_STORAGE_V1_LEGACY_JSON);
    const { boardIndexedDbStorage } = await import(
      "@/storage/board/boardStorage"
    );
    const { getWorkboardDatabase } = await import(
      "@/storage/board/database"
    );

    await expect(boardIndexedDbStorage.getItem(STORAGE_KEY)).resolves.toEqual(
      BOARD_STORAGE_V1_VALUE,
    );

    const record = await getWorkboardDatabase().boards.get(STORAGE_KEY);
    expect(record).toMatchObject({
      id: STORAGE_KEY,
      ...BOARD_STORAGE_V1_VALUE,
    });
    expect(typeof record?.updatedAt).toBe("number");
    expect(Number.isFinite(record?.updatedAt ?? Number.NaN)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("prefers IndexedDB and leaves an unused legacy record intact", async () => {
    localStorage.setItem(STORAGE_KEY, BOARD_STORAGE_V1_LEGACY_JSON);
    const databaseState: PersistedBoardState = {
      ...BOARD_STORAGE_V1_STATE,
      color: "#22c55e",
    };
    const { getWorkboardDatabase } = await import(
      "@/storage/board/database"
    );
    await getWorkboardDatabase().boards.put({
      id: STORAGE_KEY,
      state: databaseState,
      version: 1,
      updatedAt: 1_725_062_400_000,
    });
    const { boardIndexedDbStorage } = await import(
      "@/storage/board/boardStorage"
    );

    await expect(boardIndexedDbStorage.getItem(STORAGE_KEY)).resolves.toEqual({
      state: databaseState,
      version: 1,
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(
      BOARD_STORAGE_V1_LEGACY_JSON,
    );
  });

  it("rejects malformed legacy state without deleting it", async () => {
    const malformedLegacy = JSON.stringify({
      state: {
        ...BOARD_STORAGE_V1_STATE,
        lineWidth: Number.POSITIVE_INFINITY,
      },
      version: 1,
    });
    localStorage.setItem(STORAGE_KEY, malformedLegacy);
    const { boardIndexedDbStorage } = await import(
      "@/storage/board/boardStorage"
    );

    await expect(boardIndexedDbStorage.getItem(STORAGE_KEY)).resolves.toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(malformedLegacy);
  });

  it("retains valid legacy data when its IndexedDB import fails", async () => {
    vi.doMock("@/storage/board/database", () => ({
      getWorkboardDatabase: () => ({
        boards: {
          get: async () => undefined,
          put: async () => Promise.reject(new Error("IndexedDB unavailable")),
          delete: async () => undefined,
        },
      }),
    }));
    localStorage.setItem(STORAGE_KEY, BOARD_STORAGE_V1_LEGACY_JSON);
    const { boardIndexedDbStorage } = await import(
      "@/storage/board/boardStorage"
    );

    await expect(boardIndexedDbStorage.getItem(STORAGE_KEY)).resolves.toEqual(
      BOARD_STORAGE_V1_VALUE,
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe(
      BOARD_STORAGE_V1_LEGACY_JSON,
    );
  });

  it("serializes writes, preserves their order, and skips an identical value", async () => {
    const observedColors: string[] = [];
    const firstWriteBlock = createDeferred();
    const firstWriteAnnouncement = createDeferred();

    vi.doMock("@/storage/board/database", () => ({
      getWorkboardDatabase: () => ({
        boards: {
          get: async () => undefined,
          put: async (record: { id: string; state: PersistedBoardState }) => {
            observedColors.push(record.state.color);
            if (observedColors.length === 1) {
              firstWriteAnnouncement.resolve();
              await firstWriteBlock.promise;
            }
            return record.id;
          },
          delete: async () => undefined,
        },
      }),
    }));
    const { boardIndexedDbStorage } = await import(
      "@/storage/board/boardStorage"
    );
    const firstValue: StorageValue<PersistedBoardState> = {
      state: { ...BOARD_STORAGE_V1_STATE, color: "#ef4444" },
      version: 1,
    };
    const secondValue: StorageValue<PersistedBoardState> = {
      state: { ...BOARD_STORAGE_V1_STATE, color: "#3b82f6" },
      version: 1,
    };

    const firstWrite = boardIndexedDbStorage.setItem(STORAGE_KEY, firstValue);
    await firstWriteAnnouncement.promise;
    const secondWrite = boardIndexedDbStorage.setItem(STORAGE_KEY, secondValue);
    const duplicateWrite = boardIndexedDbStorage.setItem(
      STORAGE_KEY,
      secondValue,
    );

    expect(observedColors).toEqual(["#ef4444"]);
    firstWriteBlock.resolve();
    await Promise.all([firstWrite, secondWrite, duplicateWrite]);
    expect(observedColors).toEqual(["#ef4444", "#3b82f6"]);
  });

  it("deletes the singleton record", async () => {
    const { boardIndexedDbStorage } = await import(
      "@/storage/board/boardStorage"
    );
    const { getWorkboardDatabase } = await import(
      "@/storage/board/database"
    );

    await boardIndexedDbStorage.setItem(STORAGE_KEY, BOARD_STORAGE_V1_VALUE);
    await boardIndexedDbStorage.removeItem(STORAGE_KEY);

    await expect(
      getWorkboardDatabase().boards.get(STORAGE_KEY),
    ).resolves.toBeUndefined();
  });
});

describe("persisted board store boundary", () => {
  it("hydrates durable fields while transient controls keep their defaults", async () => {
    const { getWorkboardDatabase } = await import(
      "@/storage/board/database"
    );
    await getWorkboardDatabase().boards.put({
      id: STORAGE_KEY,
      ...BOARD_STORAGE_V1_VALUE,
      updatedAt: 1_725_062_400_000,
    });
    const { camera, hydrateBoardStore, useBoardStore } = await import(
      "@/store/useBoardStore"
    );

    await hydrateBoardStore();

    const state = useBoardStore.getState();
    expect(state.tool).toBe(BOARD_STORAGE_V1_STATE.tool);
    expect(state.color).toBe(BOARD_STORAGE_V1_STATE.color);
    expect(state.lineWidth).toBe(BOARD_STORAGE_V1_STATE.lineWidth);
    expect(state.strokes).toEqual(BOARD_STORAGE_V1_STATE.strokes);
    expect(state.undoStack).toEqual([]);
    expect(state.redoStack).toEqual([]);
    expect(state.selectedIndices).toEqual([]);
    expect(state.clipboardStrokes).toEqual([]);
    expect(state.pasteCount).toBe(0);
    expect(camera).toMatchObject({ offset: { x: 0, y: 0 }, scale: 1 });
  });

  it("persists only durable fields and saves an explicitly cleared board", async () => {
    const { boardIndexedDbStorage } = await import(
      "@/storage/board/boardStorage"
    );
    const { hydrateBoardStore, useBoardStore } = await import(
      "@/store/useBoardStore"
    );
    await hydrateBoardStore();

    const state = useBoardStore.getState();
    state.setTool(BOARD_STORAGE_V1_STATE.tool);
    state.setColor(BOARD_STORAGE_V1_STATE.color);
    state.setLineWidth(BOARD_STORAGE_V1_STATE.lineWidth);
    for (const stroke of BOARD_STORAGE_V1_STATE.strokes) {
      useBoardStore.getState().commitStroke(stroke);
    }
    useBoardStore.getState().setSelectedIndices([0, 1]);
    useBoardStore.getState().copySelectedStrokes();

    const stored = await boardIndexedDbStorage.getItem(STORAGE_KEY);
    expect(Object.keys(stored?.state ?? {}).sort()).toEqual([
      "color",
      "lineWidth",
      "strokes",
      "tool",
    ]);
    expect(stored?.state.strokes).toEqual(BOARD_STORAGE_V1_STATE.strokes);

    useBoardStore.getState().clear();
    const cleared = await boardIndexedDbStorage.getItem(STORAGE_KEY);
    expect(cleared?.state.strokes).toEqual([]);
  });
});
