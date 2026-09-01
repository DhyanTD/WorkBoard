import type { DesignRecord } from "@/server/design/models";

export interface DesignRepository {
  listByWorkspace(workspaceId: string): Promise<DesignRecord[]>;
  findById(designId: string): Promise<DesignRecord | null>;
  save(record: DesignRecord): Promise<void>;
}
