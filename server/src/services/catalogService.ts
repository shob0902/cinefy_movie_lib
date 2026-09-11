// Browse and search: filtering, sorting and pagination over TMDB.
import { config } from '../config/env.js';
import type { MovieDetail, MovieSummary, Paginated } from '../domain/movie.js';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { tmdbGet, type QueryParams } from '../tmdb/client.js';
import { isRenderable, toMovieDetail, toMovieSummary, type GenreMap } from '../tmdb/mappers.js';
import {
  parseList,
  tmdbMovieDetailSchema,
  tmdbMovieSummarySchema,
  tmdbPageSchema,
} from '../tmdb/schemas.js';
import { getGenreMapSafe } from './genreService.js';
export const SORT_OPTIONS = [
  'relevance',
  'popularity',
  'rating',
  'newest',
  'oldest',
  'title',
] as const;
export type SortKey = (typeof SORT_OPTIONS)[number];
export interface CatalogQuery {
  query?: string;
  genreIds: number[];
  sort: SortKey;
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  page: number;
}
export interface CatalogMeta {
  mode: 'discover' | 'search' | 'search-window';
  cacheState: string;
  degraded: boolean;
  windowedResults?: { scannedPages: number; scannedItems: number; upstreamTotal: number };
  droppedRecords?: number;
}
export type CatalogResult = Paginated<MovieSummary> & { meta: CatalogMeta };
export const PAGE_SIZE = 20;
const MAX_UPSTREAM_PAGE = 500;
const SEARCH_WINDOW_PAGES = 5;
const SORT_TO_TMDB: Record<Exclude<SortKey, 'relevance'>, string> = {
  popularity: 'popularity.desc',
  rating: 'vote_average.desc',
  newest: 'primary_release_date.desc',
  oldest: 'primary_release_date.asc',
  title: 'original_title.asc',
};
const MIN_VOTES_FOR_RATING_SORT = 300;
function nullsLast(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
}
const COMPARATORS: Record<SortKey, (a: MovieSummary, b: MovieSummary) => number> = {
  relevance: () => 0, // preserve upstream order
  popularity: (a, b) => b.popularity - a.popularity,
  rating: (a, b) => {
    const weight = (movie: MovieSummary) =>
      movie.rating === null ? null : movie.rating * Math.min(1, movie.voteCount / 100);
    return nullsLast(weight(a), weight(b), -1);
  },
  newest: (a, b) => nullsLast(a.releaseDate ? Date.parse(a.releaseDate) : null, b.releaseDate ? Date.parse(b.releaseDate) : null, -1),
  oldest: (a, b) => nullsLast(a.releaseDate ? Date.parse(a.releaseDate) : null, b.releaseDate ? Date.parse(b.releaseDate) : null, 1),
  title: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
};
function paginate<T>(items: T[], page: number, pageSize: number): Paginated<T> {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    totalItems,
    totalPages,
    hasMore: safePage < totalPages,
    nextPage: safePage < totalPages ? safePage + 1 : null,
  };
}
function readPage(
  data: unknown,
  genreMap: GenreMap,
): { movies: MovieSummary[]; totalPages: number; totalResults: number; dropped: number } {
  const page = tmdbPageSchema.safeParse(data);
  if (!page.success) {
    throw new AppError('UPSTREAM_ERROR', 'Unexpected response shape from TMDB');
  }
  const { items, dropped } = parseList(tmdbMovieSummarySchema, page.data.results);
  const usable = items.filter(isRenderable);
  if (dropped > 0) {
    logger.warn('tmdb.records_dropped', { dropped, received: page.data.results.length });
  }
  return {
    movies: usable.map((raw) => toMovieSummary(raw, genreMap)),
    totalPages: page.data.total_pages,
    totalResults: page.data.total_results,
    dropped: dropped + (items.length - usable.length),
  };
}
function listTtlMs() {
  return config.CACHE_TTL_LIST_SEC * 1000;
}
function needsLocalProcessing(query: CatalogQuery): boolean {
  return (
    query.sort !== 'relevance' ||
    query.genreIds.length > 0 ||
    query.minRating !== undefined ||
    query.yearFrom !== undefined ||
    query.yearTo !== undefined
  );
}
function applyLocalFilters(movies: MovieSummary[], query: CatalogQuery): MovieSummary[] {
  return movies.filter((movie) => {
    if (query.genreIds.length > 0) {
      const ids = new Set(movie.genres.map((genre) => genre.id));
      if (!query.genreIds.some((id) => ids.has(id))) return false;
    }
    if (query.minRating !== undefined && (movie.rating ?? 0) < query.minRating) return false;
    if (query.yearFrom !== undefined && (movie.releaseYear ?? 0) < query.yearFrom) return false;
    if (query.yearTo !== undefined && (movie.releaseYear ?? 9999) > query.yearTo) return false;
    return true;
  });
}
async function discover(
  query: CatalogQuery,
  genreMap: GenreMap,
  signal?: AbortSignal,
): Promise<CatalogResult> {
  const sortBy = query.sort === 'relevance' ? 'popularity.desc' : SORT_TO_TMDB[query.sort];
  const params: QueryParams = {
    include_adult: false,
    include_video: false,
    language: 'en-US',
    page: Math.min(query.page, MAX_UPSTREAM_PAGE),
    sort_by: sortBy,
    with_genres: query.genreIds.length ? query.genreIds.join('|') : undefined,
    'primary_release_date.gte': query.yearFrom ? `${query.yearFrom}-01-01` : undefined,
    'primary_release_date.lte': query.yearTo ? `${query.yearTo}-12-31` : undefined,
    'vote_average.gte': query.minRating,
    'vote_count.gte': query.sort === 'rating' ? MIN_VOTES_FOR_RATING_SORT : undefined,
  };
  if (query.sort === 'newest' && !query.yearTo) {
    params['primary_release_date.lte'] = new Date().toISOString().slice(0, 10);
  }
  if (query.sort === 'oldest' && !query.yearFrom) {
    params['primary_release_date.gte'] = '1900-01-01';
  }
  const { data, cacheState } = await tmdbGet<unknown>('/discover/movie', params, {
    ttlMs: listTtlMs(),
    signal,
  });
  const { movies, totalPages, totalResults, dropped } = readPage(data, genreMap);
  const cappedPages = Math.min(totalPages, MAX_UPSTREAM_PAGE);
  const page = Math.min(query.page, Math.max(1, cappedPages));
  return {
    items: movies,
    page,
    pageSize: PAGE_SIZE,
    totalItems: totalResults,
    totalPages: cappedPages,
    hasMore: page < cappedPages,
    nextPage: page < cappedPages ? page + 1 : null,
    meta: {
      mode: 'discover',
      cacheState,
      degraded: cacheState === 'stale',
      droppedRecords: dropped || undefined,
    },
  };
}
async function search(
  query: CatalogQuery,
  genreMap: GenreMap,
  signal?: AbortSignal,
): Promise<CatalogResult> {
  const { data, cacheState } = await tmdbGet<unknown>(
    '/search/movie',
    {
      query: query.query,
      include_adult: false,
      language: 'en-US',
      page: Math.min(query.page, MAX_UPSTREAM_PAGE),
    },
    { ttlMs: listTtlMs(), signal },
  );
  const { movies, totalPages, totalResults, dropped } = readPage(data, genreMap);
  const cappedPages = Math.min(totalPages, MAX_UPSTREAM_PAGE);
  const page = Math.min(query.page, Math.max(1, cappedPages));
  return {
    items: movies,
    page,
    pageSize: PAGE_SIZE,
    totalItems: totalResults,
    totalPages: cappedPages,
    hasMore: page < cappedPages,
    nextPage: page < cappedPages ? page + 1 : null,
    meta: {
      mode: 'search',
      cacheState,
      degraded: cacheState === 'stale',
      droppedRecords: dropped || undefined,
    },
  };
}
async function searchWindow(
  query: CatalogQuery,
  genreMap: GenreMap,
  signal?: AbortSignal,
): Promise<CatalogResult> {
  const fetchPage = (page: number) =>
    tmdbGet<unknown>(
      '/search/movie',
      { query: query.query, include_adult: false, language: 'en-US', page },
      { ttlMs: listTtlMs(), signal },
    );
  const first = await fetchPage(1);
  const firstPage = readPage(first.data, genreMap);
  const pagesToScan = Math.min(SEARCH_WINDOW_PAGES, Math.max(1, firstPage.totalPages));
  const rest = await Promise.allSettled(
    Array.from({ length: pagesToScan - 1 }, (_, index) => fetchPage(index + 2)),
  );
  const collected: MovieSummary[] = [...firstPage.movies];
  let dropped = firstPage.dropped;
  let cacheState = first.cacheState;
  for (const settled of rest) {
    if (settled.status !== 'fulfilled') {
      logger.warn('search.window_page_failed', { reason: String(settled.reason) });
      continue;
    }
    const parsed = readPage(settled.value.data, genreMap);
    collected.push(...parsed.movies);
    dropped += parsed.dropped;
    if (settled.value.cacheState === 'stale') cacheState = 'stale';
  }
  const deduped = Array.from(new Map(collected.map((movie) => [movie.id, movie])).values());
  const filtered = applyLocalFilters(deduped, query);
  const sorted = query.sort === 'relevance' ? filtered : filtered.slice().sort(COMPARATORS[query.sort]);
  const paginated = paginate(sorted, query.page, PAGE_SIZE);
  return {
    ...paginated,
    meta: {
      mode: 'search-window',
      cacheState,
      degraded: cacheState === 'stale',
      windowedResults: {
        scannedPages: pagesToScan,
        scannedItems: deduped.length,
        upstreamTotal: firstPage.totalResults,
      },
      droppedRecords: dropped || undefined,
    },
  };
}
export async function getCatalog(
  query: CatalogQuery,
  signal?: AbortSignal,
): Promise<CatalogResult> {
  const genreMap = await getGenreMapSafe(signal);
  if (!query.query) return discover(query, genreMap, signal);
  if (!needsLocalProcessing(query)) return search(query, genreMap, signal);
  return searchWindow(query, genreMap, signal);
}
export async function getTrending(
  window: 'day' | 'week',
  signal?: AbortSignal,
): Promise<{ items: MovieSummary[]; meta: Pick<CatalogMeta, 'cacheState' | 'degraded'> }> {
  const genreMap = await getGenreMapSafe(signal);
  const { data, cacheState } = await tmdbGet<unknown>(
    `/trending/movie/${window}`,
    { language: 'en-US' },
    { ttlMs: listTtlMs(), signal },
  );
  const { movies } = readPage(data, genreMap);
  return {
    items: movies,
    meta: { cacheState, degraded: cacheState === 'stale' },
  };
}
export async function getMovieDetail(
  id: number,
  signal?: AbortSignal,
): Promise<{ movie: MovieDetail; meta: Pick<CatalogMeta, 'cacheState' | 'degraded'> }> {
  const genreMap = await getGenreMapSafe(signal);
  const { data, cacheState } = await tmdbGet<unknown>(
    `/movie/${id}`,
    { language: 'en-US', append_to_response: 'credits,videos,recommendations' },
    { ttlMs: config.CACHE_TTL_DETAIL_SEC * 1000, signal },
  );
  const parsed = tmdbMovieDetailSchema.safeParse(data);
  if (!parsed.success) {
    logger.warn('tmdb.detail_unparseable', { id, issues: parsed.error.issues.slice(0, 3) });
    throw new AppError('UPSTREAM_ERROR', 'Movie data from TMDB could not be understood');
  }
  const recommendationsRaw = parseList(tmdbMovieSummarySchema, parsed.data.recommendations.results);
  const recommendations = recommendationsRaw.items
    .filter(isRenderable)
    .slice(0, 12)
    .map((raw) => toMovieSummary(raw, genreMap));
  return {
    movie: toMovieDetail(parsed.data, recommendations, genreMap),
    meta: { cacheState, degraded: cacheState === 'stale' },
  };
}
export async function getMovieSummary(id: number, signal?: AbortSignal): Promise<MovieSummary> {
  const { movie } = await getMovieDetail(id, signal);
  return {
    id: movie.id,
    title: movie.title,
    originalTitle: movie.originalTitle,
    overview: movie.overview,
    releaseDate: movie.releaseDate,
    releaseYear: movie.releaseYear,
    poster: movie.poster,
    backdrop: movie.backdrop,
    rating: movie.rating,
    voteCount: movie.voteCount,
    popularity: movie.popularity,
    genres: movie.genres,
    originalLanguage: movie.originalLanguage,
    adult: movie.adult,
  };
}
