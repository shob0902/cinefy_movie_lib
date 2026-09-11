// TMDB HTTP client with caching, retries, rate limiting and breaker.
import { config } from '../config/env.js';
import { backoffDelay, isAbortError, sleep, withDeadline } from '../lib/async.js';
import { LayeredCache } from '../lib/cache.js';
import { CircuitBreaker } from '../lib/circuitBreaker.js';
import { AppError } from '../lib/errors.js';
import { Semaphore, TokenBucket } from '../lib/limiter.js';
import { logger } from '../lib/logger.js';
import { tmdbErrorSchema } from './schemas.js';
export type QueryParams = Record<string, string | number | boolean | undefined | null>;
const bucket = new TokenBucket(config.TMDB_RATE_LIMIT_PER_SEC, config.TMDB_RATE_LIMIT_PER_SEC);
const gate = new Semaphore(config.TMDB_MAX_CONCURRENCY);
const breaker = new CircuitBreaker('tmdb');
export const tmdbCache = new LayeredCache(config.CACHE_MAX_ENTRIES);
let upstreamRequests = 0;
export function tmdbStats() {
  return {
    upstreamRequests,
    breaker: breaker.snapshot,
    cache: tmdbCache.stats,
  };
}
export function cacheKeyFor(path: string, params: QueryParams = {}): string {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  const query = entries.map(([key, value]) => `${key}=${value}`).join('&');
  return query ? `tmdb:${path}?${query}` : `tmdb:${path}`;
}
function buildUrl(path: string, params: QueryParams): string {
  const url = new URL(`${config.TMDB_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  if (config.tmdbAuth.kind === 'apiKey') {
    url.searchParams.set('api_key', config.tmdbAuth.key);
  }
  return url.toString();
}
function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (config.tmdbAuth.kind === 'bearer') {
    headers.authorization = `Bearer ${config.tmdbAuth.token}`;
  }
  return headers;
}
function assertConfigured() {
  if (config.tmdbAuth.kind === 'none') {
    throw new AppError(
      'NOT_CONFIGURED',
      'TMDB credentials are missing. Set TMDB_ACCESS_TOKEN (or TMDB_API_KEY) in server/.env.',
    );
  }
}
function isRetryable(error: unknown): boolean {
  if (error instanceof AppError) {
    return (
      error.code === 'RATE_LIMITED' ||
      error.code === 'UPSTREAM_UNAVAILABLE' ||
      error.code === 'UPSTREAM_TIMEOUT'
    );
  }
  return false;
}
async function readErrorMessage(response: Response): Promise<string | undefined> {
  try {
    const body = await response.json();
    return tmdbErrorSchema.safeParse(body).data?.status_message;
  } catch {
    return undefined;
  }
}
async function attempt(path: string, params: QueryParams, signal?: AbortSignal): Promise<unknown> {
  const deadline = withDeadline(config.TMDB_TIMEOUT_MS, signal);
  const startedAt = Date.now();
  try {
    await bucket.take(deadline.signal);
    upstreamRequests += 1;
    const response = await fetch(buildUrl(path, params), {
      headers: authHeaders(),
      signal: deadline.signal,
    });
    logger.debug('tmdb.request', {
      path,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    if (response.ok) return await response.json();
    const message = await readErrorMessage(response);
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after')) || 1;
      throw new AppError('RATE_LIMITED', message ?? 'Upstream rate limit reached', {
        retryAfterSec: retryAfter,
      });
    }
    if (response.status === 401 || response.status === 403) {
      throw new AppError('NOT_CONFIGURED', message ?? 'TMDB rejected our credentials');
    }
    if (response.status === 404) {
      throw new AppError('NOT_FOUND', message ?? 'Not found upstream');
    }
    if (response.status >= 500) {
      throw new AppError('UPSTREAM_UNAVAILABLE', message ?? `Upstream returned ${response.status}`);
    }
    throw new AppError('UPSTREAM_ERROR', message ?? `Upstream returned ${response.status}`, {
      details: { status: response.status },
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isAbortError(error)) {
      if (signal?.aborted) throw error;
      throw new AppError(
        'UPSTREAM_TIMEOUT',
        `TMDB did not respond within ${config.TMDB_TIMEOUT_MS}ms`,
      );
    }
    throw new AppError('UPSTREAM_UNAVAILABLE', 'Could not reach TMDB', { cause: error });
  } finally {
    deadline.cleanup();
  }
}
export async function tmdbRequest(
  path: string,
  params: QueryParams = {},
  signal?: AbortSignal,
): Promise<unknown> {
  assertConfigured();
  if (!breaker.canAttempt()) {
    throw new AppError('UPSTREAM_UNAVAILABLE', 'TMDB is currently unreachable', {
      retryAfterSec: Math.ceil(breaker.snapshot.retryInMs / 1000) || 5,
      details: { reason: 'circuit-open' },
    });
  }
  let lastError: unknown;
  for (let attemptNo = 0; attemptNo <= config.TMDB_MAX_RETRIES; attemptNo += 1) {
    try {
      const result = await gate.run(() => attempt(path, params, signal));
      breaker.recordSuccess();
      return result;
    } catch (error) {
      lastError = error;
      if (isAbortError(error) && signal?.aborted) throw error;
      if (error instanceof AppError && !isRetryable(error)) {
        if (error.code === 'UPSTREAM_ERROR') breaker.recordFailure();
        throw error;
      }
      breaker.recordFailure();
      if (attemptNo === config.TMDB_MAX_RETRIES) break;
      const retryAfterMs =
        error instanceof AppError && error.retryAfterSec
          ? error.retryAfterSec * 1000
          : backoffDelay(attemptNo);
      logger.warn('tmdb.retry', {
        path,
        attempt: attemptNo + 1,
        waitMs: retryAfterMs,
        error: error instanceof Error ? error.message : String(error),
      });
      await sleep(retryAfterMs, signal);
    }
  }
  throw lastError instanceof AppError
    ? lastError
    : new AppError('UPSTREAM_UNAVAILABLE', 'TMDB request failed', { cause: lastError });
}
export interface TmdbGetOptions {
  ttlMs: number;
  signal?: AbortSignal;
  persist?: boolean;
}
export async function tmdbGet<T = unknown>(
  path: string,
  params: QueryParams,
  options: TmdbGetOptions,
): Promise<{ data: T; cacheState: string; fetchedAt: number }> {
  const key = cacheKeyFor(path, params);
  const result = await tmdbCache.swr<unknown>(
    key,
    {
      ttlMs: options.ttlMs,
      graceMs: config.CACHE_STALE_GRACE_SEC * 1000,
      persist: options.persist !== false,
    },
    () => tmdbRequest(path, params, options.signal),
  );
  return { data: result.value as T, cacheState: result.state, fetchedAt: result.fetchedAt };
}
