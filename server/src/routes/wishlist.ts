// Wishlist REST endpoints scoped to a client id.
import { Router } from 'express';
import { z } from 'zod';
import type { MovieSummary } from '../domain/movie.js';
import type { WishlistSort } from '../db/wishlistRepository.js';
import { AppError } from '../lib/errors.js';
import { movieIdParam, parseOrThrow, positiveInt } from '../lib/validation.js';
import { asyncHandler, requireClientId } from '../middleware/index.js';
import {
  addToWishlist,
  listWishlist,
  listWishlistIds,
  removeFromWishlist,
} from '../services/wishlistService.js';
export const wishlistRouter = Router();
wishlistRouter.use(requireClientId);
const WISHLIST_SORTS = ['added_desc', 'added_asc', 'title', 'rating', 'release_desc'] as const;
const listQuerySchema = z.object({
  sort: z.enum(WISHLIST_SORTS).catch('added_desc').default('added_desc'),
  page: positiveInt(1, 10_000),
  pageSize: positiveInt(24, 100),
});
const imageSetSchema = z
  .object({
    small: z.string(),
    medium: z.string(),
    large: z.string(),
    srcSet: z.string(),
    aspectRatio: z.number(),
  })
  .nullable()
  .catch(null)
  .default(null);
const snapshotSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(1).max(500),
    originalTitle: z.string().nullable().catch(null).default(null),
    overview: z.string().max(5000).catch('').default(''),
    releaseDate: z.string().nullable().catch(null).default(null),
    releaseYear: z.number().int().nullable().catch(null).default(null),
    poster: imageSetSchema,
    backdrop: imageSetSchema,
    rating: z.number().nullable().catch(null).default(null),
    voteCount: z.number().catch(0).default(0),
    popularity: z.number().catch(0).default(0),
    genres: z
      .array(z.object({ id: z.number(), name: z.string() }))
      .catch([])
      .default([]),
    originalLanguage: z.string().nullable().catch(null).default(null),
    adult: z.boolean().catch(false).default(false),
  })
  .optional();
const addBodySchema = z.object({
  movieId: z.coerce.number().int().positive(),
  movie: snapshotSchema,
});
function userIdOf(req: { userId?: string }): string {
  if (!req.userId) throw new AppError('INTERNAL', 'Client identity missing');
  return req.userId;
}
wishlistRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const options = parseOrThrow(listQuerySchema, req.query, 'query parameters');
    res.setHeader('cache-control', 'no-store');
    res.json(
      listWishlist(userIdOf(req), {
        sort: options.sort as WishlistSort,
        page: options.page,
        pageSize: options.pageSize,
      }),
    );
  }),
);
wishlistRouter.get(
  '/ids',
  asyncHandler(async (req, res) => {
    res.setHeader('cache-control', 'no-store');
    res.json({ ids: listWishlistIds(userIdOf(req)) });
  }),
);
wishlistRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = parseOrThrow(addBodySchema, req.body, 'request body');
    const snapshot = body.movie as MovieSummary | undefined;
    const entry = await addToWishlist(userIdOf(req), body.movieId, snapshot, req.abortSignal);
    res.setHeader('cache-control', 'no-store');
    res.status(201).json(entry);
  }),
);
wishlistRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { id } = parseOrThrow(movieIdParam, req.params, 'movie id');
    removeFromWishlist(userIdOf(req), id);
    res.setHeader('cache-control', 'no-store');
    res.status(204).end();
  }),
);
