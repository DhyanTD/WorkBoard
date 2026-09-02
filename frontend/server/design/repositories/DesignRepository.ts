import type {
  AuditEvent,
  DesignRecord,
  DesignSnapshot,
  DesignWriteResult,
  PersistenceContext,
  WriteCommand,
} from "@/server/design/models";

export interface DesignRepository {
  listByWorkspace(context: PersistenceContext): Promise<DesignRecord[]>;
  findById(
    context: PersistenceContext,
    designId: string,
  ): Promise<DesignRecord | null>;
  findSnapshot(
    context: PersistenceContext,
    designId: string,
    revisionId: string,
  ): Promise<{ record: DesignRecord; snapshot: DesignSnapshot } | null>;
  create(record: DesignRecord, command: WriteCommand): Promise<DesignWriteResult>;
  appendDraft(
    designId: string,
    snapshot: DesignSnapshot,
    expectedRevisionId: string,
    command: WriteCommand,
  ): Promise<DesignWriteResult>;
  recordDenied(event: AuditEvent): Promise<void>;
}
