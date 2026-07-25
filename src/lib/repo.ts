import { supabase, isSupabaseConfigured } from './supabase';
import { offlineDb, type OutboxItem } from './db';

// ---------------------------------------------------------------------------
// Offline-first repository. Every module reads and writes through these
// functions so the command post keeps working with no network:
//
//   read  → try Supabase when online (write-through into IndexedDB),
//           fall back to the local cache otherwise
//   write → apply to the local cache immediately (UI is never blocked),
//           push to Supabase now if online, else queue in the outbox
//   sync  → flushOutbox() drains queued mutations when connectivity returns;
//           a newer server row is recorded as a conflict (last-writer-wins,
//           flagged for manual review per spec §8)
// ---------------------------------------------------------------------------

let currentTenantId: string | null = null;

/** Set by AuthContext once the profile loads; injected into every write. */
export function setRepoTenantId(tenantId: string | null) {
  currentTenantId = tenantId;
}

/** Wipe all locally cached data (IndexedDB). Call on sign-out to prevent stale
 *  data from being accessible on shared workstations. */
export async function clearOfflineData(): Promise<void> {
  await offlineDb.records.clear();
  await offlineDb.outbox.clear();
  await offlineDb.conflicts.clear();
  await offlineDb.meta.clear();
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

function canUseServer(): boolean {
  return isSupabaseConfigured && isOnline();
}

export interface ListOptions {
  /** Equality filters, e.g. { incident_id: '...' } */
  match?: Record<string, unknown>;
  orderBy?: string;
  ascending?: boolean;
  limit?: number;
}

async function cacheRows(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  await offlineDb.records.bulkPut(
    rows.map((row) => ({
      table,
      id: String(row.id),
      updated_at: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
      row
    }))
  );
}

async function listFromCache<T>(table: string, options: ListOptions): Promise<T[]> {
  const cached = await offlineDb.records.where('table').equals(table).toArray();
  let rows = cached.map((c) => c.row);
  if (options.match) {
    rows = rows.filter((row) =>
      Object.entries(options.match!).every(([k, v]) => (row as Record<string, unknown>)[k] === v)
    );
  }
  if (options.orderBy) {
    const key = options.orderBy;
    const dir = options.ascending === false ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      const av = (a as Record<string, unknown>)[key];
      const bv = (b as Record<string, unknown>)[key];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return (av < bv ? -1 : 1) * dir;
    });
  }
  if (options.limit) rows = rows.slice(0, options.limit);
  return rows as T[];
}

export async function listRecords<T = Record<string, unknown>>(
  table: string,
  options: ListOptions = {}
): Promise<T[]> {
  if (canUseServer()) {
    try {
      let query = supabase.from(table).select('*');
      if (options.match) query = query.match(options.match as Record<string, string>);
      if (options.orderBy) query = query.order(options.orderBy, { ascending: options.ascending !== false });
      if (options.limit) query = query.limit(options.limit);
      const { data, error } = await query;
      if (error) throw error;
      await cacheRows(table, (data ?? []) as Record<string, unknown>[]);
      return (data ?? []) as T[];
    } catch {
      // fall through to cache — offline resilience beats hard failure
    }
  }
  return listFromCache<T>(table, options);
}

export async function getRecord<T = Record<string, unknown>>(table: string, id: string): Promise<T | null> {
  if (canUseServer()) {
    try {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (data) {
        await cacheRows(table, [data as Record<string, unknown>]);
        return data as T;
      }
    } catch {
      // fall through to cache
    }
  }
  const cached = await offlineDb.records.get([table, id]);
  return (cached?.row as T) ?? null;
}

async function enqueue(item: Omit<OutboxItem, 'seq' | 'queued_at' | 'status' | 'attempts'>) {
  await offlineDb.outbox.add({
    ...item,
    queued_at: new Date().toISOString(),
    status: 'pending',
    attempts: 0
  });
  notifyQueueListeners();
}

/**
 * Create or update a row. Returns the saved row (with generated id).
 * Local cache is updated synchronously with the caller's view of the world;
 * the server write happens now (online) or on the next sync (offline).
 */
export async function saveRecord<T extends Record<string, unknown>>(
  table: string,
  input: T
): Promise<T & { id: string }> {
  const now = new Date().toISOString();
  const cached = input.id ? await offlineDb.records.get([table, String(input.id)]) : null;
  const row: Record<string, unknown> = {
    ...(cached?.row ?? {}),
    ...input,
    id: input.id ?? crypto.randomUUID(),
    updated_at: now
  };
  if (!cached && !row.created_at) row.created_at = now;
  if (currentTenantId && !row.tenant_id) row.tenant_id = currentTenantId;

  await cacheRows(table, [row]);

  if (canUseServer()) {
    try {
      const { data, error } = await supabase.from(table).upsert(row).select().maybeSingle();
      if (error) throw error;
      if (data) {
        await cacheRows(table, [data as Record<string, unknown>]);
        return data as T & { id: string };
      }
      return row as T & { id: string };
    } catch {
      await enqueue({ id: String(row.id), table, op: 'upsert', payload: row, base_updated_at: cached?.updated_at ?? null });
      return row as T & { id: string };
    }
  }

  await enqueue({ id: String(row.id), table, op: 'upsert', payload: row, base_updated_at: cached?.updated_at ?? null });
  return row as T & { id: string };
}

/** Insert-only write for append-only tables (audit_log) that lack updated_at. */
export async function insertRecord(table: string, input: Record<string, unknown>): Promise<void> {
  const row: Record<string, unknown> = { ...input, id: input.id ?? crypto.randomUUID() };
  if (currentTenantId && !row.tenant_id) row.tenant_id = currentTenantId;
  if (canUseServer()) {
    try {
      const { error } = await supabase.from(table).insert(row);
      if (error) throw error;
      return;
    } catch {
      // queue below
    }
  }
  await enqueue({ id: String(row.id), table, op: 'insert', payload: row, base_updated_at: null });
}

export async function deleteRecord(table: string, id: string): Promise<void> {
  const cached = await offlineDb.records.get([table, id]);
  await offlineDb.records.delete([table, id]);
  if (canUseServer()) {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      return;
    } catch {
      // queue below
    }
  }
  await enqueue({ id, table, op: 'delete', payload: null, base_updated_at: cached?.updated_at ?? null });
}

// ---------------------------------------------------------------------------
// Sync queue
// ---------------------------------------------------------------------------

let flushing = false;
const queueListeners = new Set<() => void>();

export function onQueueChange(listener: () => void): () => void {
  queueListeners.add(listener);
  return () => queueListeners.delete(listener);
}

function notifyQueueListeners() {
  queueListeners.forEach((l) => l());
}

export async function pendingCount(): Promise<number> {
  return offlineDb.outbox.where('status').equals('pending').count();
}

export async function unresolvedConflictCount(): Promise<number> {
  return offlineDb.conflicts.filter((c) => !c.acknowledged).count();
}

export async function getLastSyncedAt(): Promise<string | null> {
  const meta = await offlineDb.meta.get('lastSyncedAt');
  return meta?.value ?? null;
}

/**
 * Drain the outbox. Last-writer-wins: the queued local change is applied even
 * when the server row changed underneath, but that case is recorded in the
 * conflicts table and surfaced in the UI for manual review.
 */
export async function flushOutbox(): Promise<void> {
  if (flushing || !canUseServer()) return;
  flushing = true;
  try {
    const items = await offlineDb.outbox.where('status').equals('pending').sortBy('seq');
    for (const item of items) {
      try {
        if (item.op === 'delete') {
          const { error } = await supabase.from(item.table).delete().eq('id', item.id);
          if (error) throw error;
        } else if (item.op === 'insert') {
          const { error } = await supabase.from(item.table).insert(item.payload ?? {});
          if (error && !`${error.message}`.includes('duplicate')) throw error;
        } else {
          // Conflict detection: did the server row move past our base version?
          if (item.base_updated_at) {
            const { data: remote } = await supabase
              .from(item.table)
              .select('*')
              .eq('id', item.id)
              .maybeSingle();
            if (remote && String(remote.updated_at) > item.base_updated_at) {
              await offlineDb.conflicts.add({
                table: item.table,
                record_id: item.id,
                local: item.payload,
                remote: remote as Record<string, unknown>,
                resolved_with: 'local',
                detected_at: new Date().toISOString(),
                acknowledged: false
              });
            }
          }
          const { data, error } = await supabase.from(item.table).upsert(item.payload ?? {}).select().maybeSingle();
          if (error) throw error;
          if (data) await cacheRows(item.table, [data as Record<string, unknown>]);
        }
        if (item.seq !== undefined) await offlineDb.outbox.delete(item.seq);
      } catch (err) {
        if (item.seq !== undefined) {
          await offlineDb.outbox.update(item.seq, {
            attempts: item.attempts + 1,
            status: item.attempts + 1 >= 10 ? 'error' : 'pending',
            error: err instanceof Error ? err.message : String(err)
          });
        }
        // Network-level failure: stop and retry on the next tick.
        if (!isOnline()) break;
      }
    }
    await offlineDb.meta.put({ key: 'lastSyncedAt', value: new Date().toISOString() });
  } finally {
    flushing = false;
    notifyQueueListeners();
  }
}

/** Wire the periodic + reconnect sync loop. Called once from App. */
export function startSyncLoop(): () => void {
  const onOnline = () => void flushOutbox();
  window.addEventListener('online', onOnline);
  const interval = window.setInterval(() => void flushOutbox(), 30_000);
  void flushOutbox();
  return () => {
    window.removeEventListener('online', onOnline);
    window.clearInterval(interval);
  };
}

// ---------------------------------------------------------------------------
// Realtime (used when online; the app works fully without it)
// ---------------------------------------------------------------------------

export function subscribeTable(table: string, onChange: () => void): () => void {
  if (!isSupabaseConfigured) return () => undefined;
  const channel = supabase
    .channel(`rt-${table}-${Math.random().toString(36).slice(2, 8)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, () => onChange())
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
