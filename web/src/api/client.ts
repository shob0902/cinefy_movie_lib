// Typed fetch wrapper for the backend API: request ids, timeouts and ApiError.
import { getClientId } from '../lib/clientId';
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'NOT_CONFIGURED'
  | 'INTERNAL'
  | 'NETWORK';
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly requestId?: string;
  readonly retryAfterSec?: number;
  constructor(
    code: ApiErrorCode,
    message: string,
    options: { status?: number; requestId?: string; retryAfterSec?: number } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = options.status ?? 0;
    this.requestId = options.requestId;
    this.retryAfterSec = options.retryAfterSec;
  }
  get isRetryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
  get userMessage(): string {
    switch (this.code) {
      case 'NOT_CONFIGURED':
        return 'The movie service is not configured yet. Add a TMDB key to the server and restart it.';
      case 'RATE_LIMITED':
        return 'Too many requests in a short time. Give it a moment and try again.';
      case 'UPSTREAM_TIMEOUT':
        return 'The movie service is taking too long to respond.';
      case 'UPSTREAM_UNAVAILABLE':
      case 'UPSTREAM_ERROR':
        return 'The movie service is temporarily unavailable.';
      case 'NETWORK':
        return 'Could not reach the server. Check your connection.';
      case 'NOT_FOUND':
        return 'We could not find what you were looking for.';
      default:
        return this.message || 'Something went wrong.';
    }
  }
}
export type QueryValue = string | number | boolean | undefined | null;
export function buildPath(path: string, params: Record<string, QueryValue> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${BASE_URL}${path}?${query}` : `${BASE_URL}${path}`;
}
interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  params?: Record<string, QueryValue>;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', params, body, signal, timeoutMs = 15_000 } = options;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), timeoutMs);
  const onAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const response = await fetch(buildPath(path, params), {
      method,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        'x-client-id': getClientId(),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 204) return undefined as T;
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const envelope = (payload as { error?: { code?: string; message?: string; requestId?: string } } | null)?.error;
      const retryAfter = Number(response.headers.get('retry-after')) || undefined;
      throw new ApiError(
        (envelope?.code as ApiErrorCode) ?? 'INTERNAL',
        envelope?.message ?? `Request failed with status ${response.status}`,
        { status: response.status, requestId: envelope?.requestId, retryAfterSec: retryAfter },
      );
    }
    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('UPSTREAM_TIMEOUT', 'The request timed out', { status: 504 });
    }
    if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      throw error;
    }
    throw new ApiError('NETWORK', 'Could not reach the server');
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
