// SQLite reads and writes for wishlist rows.
import type BetterSqlite3 from 'better-sqlite3';
import type { MovieSummary } from '../domain/movie.js';
import { logger } from '../lib/logger.js';
import { getDb } from './index.js';
export interface WishlistRow {
  movieId: number;
  addedAt: string;
  snapshot: MovieSummary;
  snapshotUpdatedAt: string;
}
export type WishlistSort = 'added_desc' | 'added_asc' | 'title' | 'rating' | 'release_desc';
const ORDER_BY: Record<WishlistSort, string> = {
  added_desc: 'added_at DESC',
  added_asc: 'added_at ASC',
  title: "json_extract(snapshot_json, '$.title') COLLATE NOCASE ASC",
  rating: "json_extract(snapshot_json, '$.rating') DESC NULLS LAST, added_at DESC",
  release_desc: "json_extract(snapshot_json, '$.releaseDate') DESC NULLS LAST",
};
export function createWishlistRepository() {
  const db = getDb();
  const upsertUser = db.prepare(
    `INSERT INTO users (id, created_at, last_seen_at)
     VALUES (@id, @now, @now)
     ON CONFLICT(id) DO UPDATE SET last_seen_at = excluded.last_seen_at`,
  );
  const insertItem = db.prepare(
    `INSERT INTO wishlist_items (user_id, movie_id, added_at, snapshot_json, snapshot_updated_at)
     VALUES (@user_id, @movie_id, @added_at, @snapshot_json, @snapshot_updated_at)
     ON CONFLICT(user_id, movie_id) DO UPDATE SET
       snapshot_json       = excluded.snapshot_json,
       snapshot_updated_at = excluded.snapshot_updated_at`,
  );
  const deleteItem = db.prepare<[string, number]>(
    'DELETE FROM wishlist_items WHERE user_id = ? AND movie_id = ?',
  );
  const countItems = db.prepare<[string]>(
    'SELECT COUNT(*) AS total FROM wishlist_items WHERE user_id = ?',
  );
  const selectIds = db.prepare<[string]>(
    'SELECT movie_id FROM wishlist_items WHERE user_id = ? ORDER BY added_at DESC',
  );
  const selectOne = db.prepare<[string, number]>(
    `SELECT movie_id, added_at, snapshot_json, snapshot_updated_at
       FROM wishlist_items WHERE user_id = ? AND movie_id = ?`,
  );
  const listStatements = Object.fromEntries(
    Object.entries(ORDER_BY).map(([sort, clause]) => [
      sort,
      db.prepare<[string, number, number]>(
        `SELECT movie_id, added_at, snapshot_json, snapshot_updated_at
           FROM wishlist_items
          WHERE user_id = ?
          ORDER BY ${clause}
          LIMIT ? OFFSET ?`,
      ),
    ]),
  ) as Record<WishlistSort, BetterSqlite3.Statement<[string, number, number]>>;
  function decode(row: {
    movie_id: number;
    added_at: string;
    snapshot_json: string;
    snapshot_updated_at: string;
  }): WishlistRow | null {
    try {
      return {
        movieId: row.movie_id,
        addedAt: row.added_at,
        snapshot: JSON.parse(row.snapshot_json) as MovieSummary,
        snapshotUpdatedAt: row.snapshot_updated_at,
      };
    } catch (error) {
      logger.warn('wishlist.snapshot_unreadable', { movieId: row.movie_id, error: String(error) });
      return null;
    }
  }
  return {
    touchUser(userId: string) {
      upsertUser.run({ id: userId, now: new Date().toISOString() });
    },
    get(userId: string, movieId: number): WishlistRow | null {
      const row = selectOne.get(userId, movieId) as Parameters<typeof decode>[0] | undefined;
      return row ? decode(row) : null;
    },
    add(userId: string, movie: MovieSummary): WishlistRow {
      const now = new Date().toISOString();
      const existing = selectOne.get(userId, movie.id) as
        | Parameters<typeof decode>[0]
        | undefined;
      insertItem.run({
        user_id: userId,
        movie_id: movie.id,
        added_at: now,
        snapshot_json: JSON.stringify(movie),
        snapshot_updated_at: now,
      });
      return {
        movieId: movie.id,
        addedAt: existing?.added_at ?? now,
        snapshot: movie,
        snapshotUpdatedAt: now,
      };
    },
    remove(userId: string, movieId: number): boolean {
      return deleteItem.run(userId, movieId).changes > 0;
    },
    count(userId: string): number {
      return (countItems.get(userId) as { total: number }).total;
    },
    ids(userId: string): number[] {
      return (selectIds.all(userId) as Array<{ movie_id: number }>).map((row) => row.movie_id);
    },
    list(
      userId: string,
      options: { sort: WishlistSort; limit: number; offset: number },
    ): WishlistRow[] {
      const statement = listStatements[options.sort];
      const rows = statement.all(userId, options.limit, options.offset) as Array<
        Parameters<typeof decode>[0]
      >;
      return rows.map(decode).filter((row): row is WishlistRow => row !== null);
    },
  };
}
export type WishlistRepository = ReturnType<typeof createWishlistRepository>;
