// Movie catalogue, search, detail and trending endpoints.
import { Router } from 'express';
import { z } from 'zod';
import { csvIds, movieIdParam, parseOrThrow, positiveInt } from '../lib/validation.js';
import { asyncHandler } from '../middleware/index.js';
import {
  SORT_OPTIONS,
  getCatalog,
  getMovieDetail,
  getTrending,
  type CatalogQuery,
} from '../services/catalogService.js';
export const moviesRouter = Router();
const CURRENT_YEAR = new Date().getFullYear();
const catalogQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    genres: csvIds,
    sort: z.enum(SORT_OPTIONS).catch('relevance').default('relevance'),
    yearFrom: z.coerce.number().int().min(1874).max(CURRENT_YEAR + 10).optional(),
    yearTo: z.coerce.number().int().min(1874).max(CURRENT_YEAR + 10).optional(),
    minRating: z.coerce.number().min(0).max(10).optional(),
    page: positiveInt(1, 500),
  })
  .transform((value): CatalogQuery => {
    const [yearFrom, yearTo] =
      value.yearFrom !== undefined && value.yearTo !== undefined && value.yearFrom > value.yearTo
        ? [value.yearTo, value.yearFrom]
        : [value.yearFrom, value.yearTo];
    return {
      query: value.q && value.q.length > 0 ? value.q : undefined,
      genreIds: value.genres,
      sort: value.sort,
      yearFrom,
      yearTo,
      minRating: value.minRating,
      page: value.page,
    };
  });
moviesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = parseOrThrow(catalogQuerySchema, req.query, 'query parameters');
    const result = await getCatalog(query, req.abortSignal);
    res.setHeader('cache-control', 'public, max-age=60, stale-while-revalidate=600');
    res.json(result);
  }),
);
moviesRouter.get(
  '/trending',
  asyncHandler(async (req, res) => {
    const { window } = parseOrThrow(
      z.object({ window: z.enum(['day', 'week']).catch('week').default('week') }),
      req.query,
      'query parameters',
    );
    const result = await getTrending(window, req.abortSignal);
    res.setHeader('cache-control', 'public, max-age=300, stale-while-revalidate=3600');
    res.json(result);
  }),
);
moviesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(movieIdParam, req.params, 'movie id');
    const result = await getMovieDetail(id, req.abortSignal);
    res.setHeader('cache-control', 'public, max-age=600, stale-while-revalidate=86400');
    res.json(result);
  }),
);
