// Wishlist logic over the repository and TMDB.
import type { MovieSummary, Paginated, WishlistEntry } from '../domain/movie.js';
import {
  createWishlistRepository,
  type WishlistRepository,
  type WishlistSort,
} from '../db/wishlistRepository.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { getMovieSummary } from './catalogService.js';
let repository: WishlistRepository | undefined;
function repo(): WishlistRepository {
  repository ??= createWishlistRepository();
  return repository;
}
export interface WishlistListOptions {
  sort: WishlistSort;
  page: number;
  pageSize: number;
}
export function listWishlist(
  userId: string,
  options: WishlistListOptions,
): Paginated<WishlistEntry> {
  const store = repo();
  store.touchUser(userId);
  const totalItems = store.count(userId);
  const totalPages = Math.max(1, Math.ceil(totalItems / options.pageSize));
  const page = Math.min(Math.max(1, options.page), totalPages);
  const rows = store.list(userId, {
    sort: options.sort,
    limit: options.pageSize,
    offset: (page - 1) * options.pageSize,
  });
  return {
    items: rows.map((row) => ({
      movie: row.snapshot,
      addedAt: row.addedAt,
      snapshotUpdatedAt: row.snapshotUpdatedAt,
    })),
    page,
    pageSize: options.pageSize,
    totalItems,
    totalPages,
    hasMore: page < totalPages,
    nextPage: page < totalPages ? page + 1 : null,
  };
}
export function listWishlistIds(userId: string): number[] {
  const store = repo();
  store.touchUser(userId);
  return store.ids(userId);
}
export async function addToWishlist(
  userId: string,
  movieId: number,
  clientSnapshot?: MovieSummary,
  signal?: AbortSignal,
): Promise<WishlistEntry> {
  const store = repo();
  store.touchUser(userId);
  let movie: MovieSummary;
  try {
    movie = await getMovieSummary(movieId, signal);
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') throw error;
    if (clientSnapshot && clientSnapshot.id === movieId) {
      logger.warn('wishlist.using_client_snapshot', { movieId, error: String(error) });
      movie = clientSnapshot;
    } else {
      throw error;
    }
  }
  const row = store.add(userId, movie);
  return {
    movie: row.snapshot,
    addedAt: row.addedAt,
    snapshotUpdatedAt: row.snapshotUpdatedAt,
  };
}
export function removeFromWishlist(userId: string, movieId: number): void {
  const store = repo();
  store.touchUser(userId);
  if (!store.remove(userId, movieId)) {
    throw AppError.notFound('That movie is not in your wishlist');
  }
}
export function isInWishlist(userId: string, movieId: number): boolean {
  return repo().get(userId, movieId) !== null;
}
