import "reflect-metadata";
import { DataSource } from "typeorm";
import { openWorkBoardEntities } from "@/server/persistence/entities";

const runtimeGlobal = globalThis as typeof globalThis & {
  openWorkBoardDataSource?: DataSource;
  openWorkBoardDataSourcePromise?: Promise<DataSource>;
};

const createDataSource = () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for PostgreSQL persistence.");
  return new DataSource({
    type: "postgres",
    url,
    entities: openWorkBoardEntities,
    synchronize: false,
    migrationsRun: false,
    logging: process.env.DATABASE_LOGGING === "true",
    ssl:
      process.env.DATABASE_SSL === "require"
        ? { rejectUnauthorized: true }
        : false,
  });
};

export const getOpenWorkBoardDataSource = async () => {
  if (runtimeGlobal.openWorkBoardDataSource?.isInitialized) {
    return runtimeGlobal.openWorkBoardDataSource;
  }
  runtimeGlobal.openWorkBoardDataSourcePromise ??= createDataSource()
    .initialize()
    .then((dataSource) => {
      runtimeGlobal.openWorkBoardDataSource = dataSource;
      return dataSource;
    });
  return runtimeGlobal.openWorkBoardDataSourcePromise;
};
