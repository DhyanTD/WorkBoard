import Dexie, { type EntityTable } from "dexie";
import type { BoardStorageRecord } from "@/storage/board/types";

export const WORKBOARD_DATABASE_NAME = "open-workboard";

export class WorkboardDatabase extends Dexie {
  boards!: EntityTable<BoardStorageRecord, "id">;

  constructor() {
    super(WORKBOARD_DATABASE_NAME);

    // Only the singleton record ID is queried. Board contents remain unindexed.
    this.version(1).stores({
      boards: "id",
    });
  }
}

let database: WorkboardDatabase | null = null;

export const getWorkboardDatabase = () => {
  database ??= new WorkboardDatabase();
  return database;
};
