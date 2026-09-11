// SQLite durable tier behind the layered cache.
import type { CacheRecord, PersistentTier } from '../lib/cache.js';
import { logger } from '../lib/logger.js';
import { getDb } from './index.js';
export function createCacheRepository(): PersistentTier & { purgeExpired(): number } {
  const db = getDb();
  const selectStmt = db.prepare<[string, number]>(
    'SELECT value_json, fetched_at, expires_at FROM http_cache WHERE key = ? AND purge_at > ?',
  );
  const upsertStmt = db.prepare(
    `INSERT INTO http_cache (key, value_json, fetched_at, expires_at, purge_at)
     VALUES (@key, @value_json, @fetched_at, @expires_at, @purge_at)
     ON CONFLICT(key) DO UPDATE SET
       value_json = excluded.value_json,
       fetched_at = excluded.fetched_at,
       expires_at = excluded.expires_at,
       purge_at   = excluded.purge_at`,
  );
  const deleteStmt = db.prepare<[string]>('DELETE FROM http_cache WHERE key = ?');
  const purgeStmt = db.prepare<[number]>('DELETE FROM http_cache WHERE purge_at <= ?');
  return {
    get(key) {
      const row = selectStmt.get(key, Date.now()) as
        | { value_json: string; fetched_at: number; expires_at: number }
        | undefined;
      if (!row) return undefined;
      try {
        return {
          value: JSON.parse(row.value_json) as unknown,
          fetchedAt: row.fetched_at,
          expiresAt: row.expires_at,
        };
      } catch {
        deleteStmt.run(key);
        return undefined;
      }
    },
    set(key, record: CacheRecord, graceMs: number) {
      upsertStmt.run({
        key,
        value_json: JSON.stringify(record.value),
        fetched_at: record.fetchedAt,
        expires_at: record.expiresAt,
        purge_at: record.expiresAt + graceMs,
      });
    },
    delete(key) {
      deleteStmt.run(key);
    },
    purgeExpired() {
      const result = purgeStmt.run(Date.now());
      if (result.changes > 0) logger.debug('cache.purged', { rows: result.changes });
      return result.changes;
    },
  };
}
