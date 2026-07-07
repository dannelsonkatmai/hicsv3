import Dexie, { type Table } from 'dexie';

// IndexedDB persistence for offline-first command-post operation. The app
// reads and writes through the repo layer (repo.ts), which caches every row
// here and queues offline mutations in the outbox for later sync.

export interface CachedRecord {
  table: string;
  id: string;
  updated_at: string;
  row: Record<string, unknown>;
}

export interface OutboxItem {
  seq?: number;
  id: string;
  table: string;
  op: 'upsert' | 'delete' | 'insert';
  payload: Record<string, unknown> | null;
  /** Server updated_at at the time the local edit was made — used for conflict detection. */
  base_updated_at: string | null;
  queued_at: string;
  status: 'pending' | 'error';
  error?: string;
  attempts: number;
}

export interface ConflictItem {
  seq?: number;
  table: string;
  record_id: string;
  local: Record<string, unknown> | null;
  remote: Record<string, unknown> | null;
  resolved_with: 'local' | 'remote';
  detected_at: string;
  acknowledged: boolean;
}

export interface MetaItem {
  key: string;
  value: string;
}

class HicsOfflineDb extends Dexie {
  records!: Table<CachedRecord, [string, string]>;
  outbox!: Table<OutboxItem, number>;
  conflicts!: Table<ConflictItem, number>;
  meta!: Table<MetaItem, string>;

  constructor() {
    super('hics-offline');
    this.version(1).stores({
      records: '[table+id], table, updated_at',
      outbox: '++seq, table, status',
      conflicts: '++seq, table, acknowledged',
      meta: 'key'
    });
  }
}

export const offlineDb = new HicsOfflineDb();
