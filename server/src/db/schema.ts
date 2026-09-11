// Ordered forward-only migrations tracked by PRAGMA user_version.
import type Database from 'better-sqlite3';
import { logger } from '../lib/logger.js';
const MIGRATIONS: Array<{ name: string; up: string }> = [
  {
    name: '001_initial',
    up: `
      -- Anonymous device identity. We deliberately do not collect any personal
      -- data: the client mints a UUID, stores it locally, and sends it as a
      -- header. Swapping this for real auth means populating this table from
      -- the identity provider instead.
      CREATE TABLE users (
        id            TEXT PRIMARY KEY,
        created_at    TEXT NOT NULL,
        last_seen_at  TEXT NOT NULL
      );

      -- The wishlist is *our* data, so it lives in our database.
      -- We also store a denormalised snapshot of the movie as it looked when it
      -- was saved. That keeps the wishlist renderable when TMDB is slow or down,
      -- and means listing N saved movies costs zero upstream requests.
      CREATE TABLE wishlist_items (
        user_id             TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        movie_id            INTEGER NOT NULL,
        added_at            TEXT    NOT NULL,
        snapshot_json       TEXT    NOT NULL,
        snapshot_updated_at TEXT    NOT NULL,
        PRIMARY KEY (user_id, movie_id)
      );

      CREATE INDEX idx_wishlist_user_added
        ON wishlist_items (user_id, added_at DESC);

      -- Durable tier of the response cache. Survives restarts and deploys, so a
      -- cold process does not have to re-fetch everything, and gives us stale
      -- data to fall back on if TMDB is unavailable at boot.
      CREATE TABLE http_cache (
        key         TEXT    PRIMARY KEY,
        value_json  TEXT    NOT NULL,
        fetched_at  INTEGER NOT NULL,
        expires_at  INTEGER NOT NULL,
        purge_at    INTEGER NOT NULL
      );

      CREATE INDEX idx_http_cache_purge ON http_cache (purge_at);
    `,
  },
];
export function migrate(db: Database.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number;
  if (current >= MIGRATIONS.length) return;
  for (let version = current; version < MIGRATIONS.length; version += 1) {
    const migration = MIGRATIONS[version];
    if (!migration) continue;
    db.transaction(() => {
      db.exec(migration.up);
      db.pragma(`user_version = ${version + 1}`);
    })();
    logger.info('db.migrated', { migration: migration.name, version: version + 1 });
  }
}
