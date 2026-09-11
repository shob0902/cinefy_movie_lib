// Cached genre lookup used to resolve genre ids to names.
import { config } from '../config/env.js';
import type { Genre, GenreWithArtwork } from '../domain/movie.js';
import { logger } from '../lib/logger.js';
import { tmdbGet } from '../tmdb/client.js';
import { buildImageSet } from '../tmdb/images.js';
import type { GenreMap } from '../tmdb/mappers.js';
import { parseList, tmdbGenreListSchema, tmdbMovieSummarySchema, tmdbPageSchema } from '../tmdb/schemas.js';
export async function getGenres(signal?: AbortSignal): Promise<Genre[]> {
  const { data } = await tmdbGet<unknown>(
    '/genre/movie/list',
    { language: 'en-US' },
    { ttlMs: config.CACHE_TTL_GENRES_SEC * 1000, signal },
  );
  const parsed = tmdbGenreListSchema.safeParse(data);
  if (!parsed.success) return [];
  return parsed.data.genres
    .filter((genre) => genre.name.length > 0)
    .map((genre) => ({ id: genre.id, name: genre.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
const ARTWORK_MIN_VOTES = 400;
interface ArtworkCandidate {
  movieId: number;
  posterPath: string | null;
  title: string | null;
}
async function candidatesFor(genre: Genre, signal?: AbortSignal): Promise<ArtworkCandidate[]> {
  try {
    const { data } = await tmdbGet<unknown>(
      '/discover/movie',
      {
        with_genres: genre.id,
        sort_by: 'popularity.desc',
        'vote_count.gte': ARTWORK_MIN_VOTES,
        include_adult: false,
        language: 'en-US',
        page: 1,
      },
      { ttlMs: config.CACHE_TTL_GENRES_SEC * 1000, signal },
    );
    const page = tmdbPageSchema.safeParse(data);
    if (!page.success) return [];
    const { items } = parseList(tmdbMovieSummarySchema, page.data.results);
    return items
      .filter((movie) => movie.poster_path !== null)
      .map((movie) => ({
        movieId: movie.id,
        posterPath: movie.poster_path,
        title: movie.title ?? movie.original_title,
      }));
  } catch (error) {
    logger.warn('genres.artwork_failed', { genre: genre.name, error: String(error) });
    return [];
  }
}
export async function getGenresWithArtwork(signal?: AbortSignal): Promise<GenreWithArtwork[]> {
  const genres = await getGenres(signal);
  const candidates = await Promise.all(genres.map((genre) => candidatesFor(genre, signal)));
  const used = new Set<number>();
  return genres.map((genre, index) => {
    const options = candidates[index] ?? [];
    const pick = options.find((option) => !used.has(option.movieId)) ?? options[0];
    if (pick) used.add(pick.movieId);
    return {
      ...genre,
      artwork: pick ? buildImageSet(pick.posterPath, 'poster') : null,
      artworkTitle: pick?.title ?? null,
    };
  });
}
export async function getGenreMapSafe(signal?: AbortSignal): Promise<GenreMap> {
  try {
    const genres = await getGenres(signal);
    return new Map(genres.map((genre) => [genre.id, genre.name]));
  } catch (error) {
    logger.warn('genres.lookup_failed', { error: String(error) });
    return new Map();
  }
}
