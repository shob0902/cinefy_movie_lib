// AppError and the error codes this API can return.
export type ErrorCode =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_ERROR'
  | 'NOT_CONFIGURED'
  | 'INTERNAL';
const DEFAULT_STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 503,
  UPSTREAM_TIMEOUT: 504,
  UPSTREAM_ERROR: 502,
  NOT_CONFIGURED: 503,
  INTERNAL: 500,
};
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  readonly retryAfterSec?: number;
  constructor(
    code: ErrorCode,
    message: string,
    options: { status?: number; details?: unknown; cause?: unknown; retryAfterSec?: number } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = options.status ?? DEFAULT_STATUS[code];
    this.details = options.details;
    this.retryAfterSec = options.retryAfterSec;
  }
  static badRequest(message: string, details?: unknown) {
    return new AppError('BAD_REQUEST', message, { details });
  }
  static notFound(message = 'Resource not found') {
    return new AppError('NOT_FOUND', message);
  }
}
export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  const message = error instanceof Error ? error.message : 'Unexpected error';
  return new AppError('INTERNAL', message, { cause: error });
}
