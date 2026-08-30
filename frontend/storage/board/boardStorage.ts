import type {
  PersistStorage,
  StorageValue,
} from "zustand/middleware";
import { getWorkboardDatabase } from "@/storage/board/database";
import {
  readLegacyBoardStorage,
  removeLegacyBoardStorage,
} from "@/storage/board/legacyLocalStorage";
import type {
  BoardStorageRecord,
  PersistedBoardState,
} from "@/storage/board/types";

export const BOARD_STORAGE_KEY = "open-workboard-board";

const areSameState = (
  left: PersistedBoardState,
  right: PersistedBoardState,
) =>
  left.tool === right.tool &&
  left.color === right.color &&
  left.lineWidth === right.lineWidth &&
  left.strokes === right.strokes;

let lastStoredValue: StorageValue<PersistedBoardState> | null = null;
let writeQueue: Promise<void> = Promise.resolve();

const enqueueWrite = (operation: () => Promise<void>) => {
  writeQueue = writeQueue.then(operation);
  return writeQueue;
};

const toStorageValue = (
  record: BoardStorageRecord,
): StorageValue<PersistedBoardState> => ({
  state: record.state,
  version: record.version,
});

export const boardIndexedDbStorage: PersistStorage<
  PersistedBoardState,
  Promise<void>
> = {
  getItem: async (name) => {
    await writeQueue;
    try {
      const database = getWorkboardDatabase();
      const record = await database.boards.get(name);
      if (record) {
        lastStoredValue = toStorageValue(record);
        return lastStoredValue;
      }

      const legacyValue = readLegacyBoardStorage(name);
      if (!legacyValue) return null;

      await database.boards.put({
        id: name,
        ...legacyValue,
        updatedAt: Date.now(),
      });
      removeLegacyBoardStorage(name);
      lastStoredValue = legacyValue;
      return legacyValue;
    } catch {
      return readLegacyBoardStorage(name);
    }
  },

  setItem: (name, value) => {
    if (
      lastStoredValue &&
      lastStoredValue.version === value.version &&
      areSameState(lastStoredValue.state, value.state)
    ) {
      return writeQueue;
    }

    lastStoredValue = value;
    return enqueueWrite(async () => {
      try {
        await getWorkboardDatabase().boards.put({
          id: name,
          ...value,
          updatedAt: Date.now(),
        });
      } catch {
        // The in-memory board remains usable when IndexedDB is unavailable.
      }
    });
  },

  removeItem: (name) => {
    lastStoredValue = null;
    return enqueueWrite(async () => {
      try {
        await getWorkboardDatabase().boards.delete(name);
      } catch {
        // There is nothing else to clear when IndexedDB is unavailable.
      }
    });
  },
};
