import { describe, expect, it } from "vitest";
import { DataSource } from "typeorm";
import { openWorkBoardEntities } from "@/server/persistence/entities";

class MetadataDataSource extends DataSource {
  buildWithoutConnecting() {
    return this.buildMetadatas();
  }
}

describe("M4 TypeORM entity metadata", () => {
  it("builds all schemas without database synchronization or migrations", async () => {
    const dataSource = new MetadataDataSource({
      type: "postgres",
      url: "postgresql://metadata:metadata@localhost/metadata",
      entities: openWorkBoardEntities,
      synchronize: false,
      migrationsRun: false,
    });

    await dataSource.buildWithoutConnecting();

    expect(dataSource.entityMetadatas.map((metadata) => metadata.tableName).sort()).toEqual([
      "audit_events",
      "design_revisions",
      "designs",
      "external_identities",
      "idempotency_records",
      "principals",
      "workspace_memberships",
      "workspaces",
    ]);
    const revision = dataSource.getMetadata("DesignRevision");
    expect(revision.findColumnWithPropertyName("document")?.type).toBe("jsonb");
    expect(
      revision.foreignKeys.flatMap((foreignKey) =>
        foreignKey.columns.map((column) => column.propertyName),
      ),
    ).toEqual(["designId", "createdByActorId"]);
    expect(
      dataSource
        .getMetadata("ExternalIdentity")
        .foreignKeys.flatMap((foreignKey) =>
          foreignKey.columns.map((column) => column.propertyName),
        ),
    ).toEqual(["principalId"]);
    expect(
      dataSource
        .getMetadata("IdempotencyRecord")
        .foreignKeys.flatMap((foreignKey) =>
          foreignKey.columns.map((column) => column.propertyName),
        ),
    ).toEqual([
      "workspaceId",
      "actorId",
      "resultDesignId",
      "resultRevisionId",
    ]);
    expect(dataSource.options.synchronize).toBe(false);
    expect(dataSource.options.migrationsRun).toBe(false);
  });
});
