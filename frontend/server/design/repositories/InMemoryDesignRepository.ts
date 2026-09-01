import type { DesignRepository } from "@/server/design/repositories/DesignRepository";
import type { DesignRecord } from "@/server/design/models";

const cloneRecord = (record: DesignRecord): DesignRecord => structuredClone(record);

export class InMemoryDesignRepository implements DesignRepository {
  private readonly records = new Map<string, DesignRecord>();

  constructor(seedRecords: DesignRecord[] = []) {
    for (const record of seedRecords) this.records.set(record.id, cloneRecord(record));
  }

  async listByWorkspace(workspaceId: string) {
    return [...this.records.values()]
      .filter((record) => record.workspaceId === workspaceId)
      .map(cloneRecord)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  async findById(designId: string) {
    const record = this.records.get(designId);
    return record ? cloneRecord(record) : null;
  }

  async save(record: DesignRecord) {
    this.records.set(record.id, cloneRecord(record));
  }
}
