// Validated environment configuration with safe defaults.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';
const here = path.dirname(fileURLToPath(import.meta.url));
export const packageRoot = path.resolve(here, '..', '..');
dotenv.config({ path: path.join(packageRoot, '.env') });
const num = (fallback: number) =>
  z.coerce.number().finite().catch(fallback).default(fallback);
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: num(4000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('info'),
  TMDB_ACCESS_TOKEN: z.string().trim().optional(),
  TMDB_API_KEY: z.string().trim().optional(),
  TMDB_BASE_URL: z.string().url().default('https://api.themoviedb.org/3'),
  TMDB_IMAGE_BASE_URL: z.string().url().default('https://image.tmdb.org/t/p'),
  TMDB_TIMEOUT_MS: num(8000),
  TMDB_MAX_RETRIES: num(2),
  TMDB_RATE_LIMIT_PER_SEC: num(20),
  TMDB_MAX_CONCURRENCY: num(8),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  DATABASE_FILE: z.string().default('./data/cinefy.sqlite'),
  CACHE_MAX_ENTRIES: num(1000),
  CACHE_TTL_LIST_SEC: num(300),
  CACHE_TTL_DETAIL_SEC: num(3600),
  CACHE_TTL_GENRES_SEC: num(86_400),
  CACHE_TTL_CONFIG_SEC: num(86_400),
  CACHE_STALE_GRACE_SEC: num(86_400),
  RATE_LIMIT_PER_MIN: num(240),
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('[config] invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
const raw = parsed.data;
export const config = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  databaseFile: path.isAbsolute(raw.DATABASE_FILE)
    ? raw.DATABASE_FILE
    : path.join(packageRoot, raw.DATABASE_FILE),
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  tmdbAuth: raw.TMDB_ACCESS_TOKEN
    ? ({ kind: 'bearer', token: raw.TMDB_ACCESS_TOKEN } as const)
    : raw.TMDB_API_KEY
      ? ({ kind: 'apiKey', key: raw.TMDB_API_KEY } as const)
      : ({ kind: 'none' } as const),
} as const;
export type Config = typeof config;
