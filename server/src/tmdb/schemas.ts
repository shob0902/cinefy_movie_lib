// Lenient Zod parsers for TMDB payloads.
import { z } from 'zod';
const nullableString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed.length > 0 ? trimmed : null;
  })
  .catch(null);
const stringOrEmpty = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (typeof value === 'string' ? value.trim() : ''))
  .catch('');
const nullableNumber = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((value) => {
    const parsed = typeof value === 'string' ? Number(value) : value;
    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
  })
  .catch(null);
const numberOrZero = nullableNumber.transform((value) => value ?? 0);
const boolOrFalse = z.boolean().catch(false).default(false);
const numberArray = z
  .array(z.number())
  .catch([])
  .default([])
  .transform((values) => values.filter((value) => Number.isFinite(value)));
export const tmdbGenreSchema = z.object({
  id: z.number(),
  name: stringOrEmpty,
});
export const tmdbGenreListSchema = z.object({
  genres: z.array(tmdbGenreSchema).catch([]).default([]),
});
export const tmdbMovieSummarySchema = z.object({
  id: z.number(),
  title: nullableString,
  original_title: nullableString,
  overview: stringOrEmpty,
  release_date: nullableString,
  poster_path: nullableString,
  backdrop_path: nullableString,
  vote_average: nullableNumber,
  vote_count: numberOrZero,
  popularity: numberOrZero,
  genre_ids: numberArray,
  genres: z.array(tmdbGenreSchema).catch([]).optional(),
  original_language: nullableString,
  adult: boolOrFalse,
});
export type TmdbMovieSummary = z.infer<typeof tmdbMovieSummarySchema>;
export const tmdbPageSchema = z.object({
  page: z.number().catch(1).default(1),
  total_pages: z.number().catch(0).default(0),
  total_results: z.number().catch(0).default(0),
  results: z.array(z.unknown()).catch([]).default([]),
});
const tmdbCastSchema = z.object({
  id: z.number(),
  name: stringOrEmpty,
  character: nullableString,
  profile_path: nullableString,
  order: numberOrZero,
});
const tmdbCrewSchema = z.object({
  id: z.number(),
  name: stringOrEmpty,
  job: stringOrEmpty,
  department: stringOrEmpty,
  profile_path: nullableString,
});
const tmdbVideoSchema = z.object({
  key: stringOrEmpty,
  site: stringOrEmpty,
  name: stringOrEmpty,
  type: stringOrEmpty,
  official: boolOrFalse,
  size: numberOrZero,
  published_at: nullableString,
});
const namedEntity = z.object({ name: stringOrEmpty });
export const tmdbMovieDetailSchema = tmdbMovieSummarySchema.extend({
  tagline: nullableString,
  status: nullableString,
  runtime: nullableNumber,
  homepage: nullableString,
  imdb_id: nullableString,
  budget: nullableNumber,
  revenue: nullableNumber,
  production_companies: z.array(namedEntity).catch([]).default([]),
  production_countries: z.array(namedEntity).catch([]).default([]),
  spoken_languages: z
    .array(z.object({ english_name: nullableString, name: nullableString }))
    .catch([])
    .default([]),
  credits: z
    .object({
      cast: z.array(tmdbCastSchema).catch([]).default([]),
      crew: z.array(tmdbCrewSchema).catch([]).default([]),
    })
    .catch({ cast: [], crew: [] })
    .default({ cast: [], crew: [] }),
  videos: z
    .object({ results: z.array(tmdbVideoSchema).catch([]).default([]) })
    .catch({ results: [] })
    .default({ results: [] }),
  recommendations: tmdbPageSchema.catch({
    page: 1,
    total_pages: 0,
    total_results: 0,
    results: [],
  }),
});
export type TmdbMovieDetail = z.infer<typeof tmdbMovieDetailSchema>;
export const tmdbConfigurationSchema = z.object({
  images: z
    .object({
      secure_base_url: nullableString,
      poster_sizes: z.array(z.string()).catch([]).default([]),
      backdrop_sizes: z.array(z.string()).catch([]).default([]),
      profile_sizes: z.array(z.string()).catch([]).default([]),
    })
    .catch({
      secure_base_url: null,
      poster_sizes: [],
      backdrop_sizes: [],
      profile_sizes: [],
    }),
});
export const tmdbErrorSchema = z.object({
  status_code: z.number().optional(),
  status_message: z.string().optional(),
});
export function parseList<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown[],
): { items: Array<z.output<S>>; dropped: number } {
  const items: Array<z.output<S>> = [];
  let dropped = 0;
  for (const candidate of input) {
    const result = schema.safeParse(candidate);
    if (result.success) items.push(result.data);
    else dropped += 1;
  }
  return { items, dropped };
}
