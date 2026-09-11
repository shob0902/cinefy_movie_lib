// Request context, client id, rate limiting and error handlers.
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { config } from '../config/env.js';
import { AppError, toAppError } from '../lib/errors.js';
import { FixedWindowCounter } from '../lib/limiter.js';
import { logger } from '../lib/logger.js';
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      userId?: string;
      abortSignal: AbortSignal;
      startedAt: number;
    }
  }
}
export const requestContext: RequestHandler = (req, res, next) => {
  req.id = req.get('x-request-id') ?? randomUUID();
  req.startedAt = Date.now();
  const controller = new AbortController();
  req.abortSignal = controller.signal;
  res.on('close', () => {
    if (!res.writableEnded) controller.abort(new Error('Client disconnected'));
  });
  res.setHeader('x-request-id', req.id);
  res.on('finish', () => {
    const durationMs = Date.now() - req.startedAt;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]('http', {
      id: req.id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs,
    });
  });
  next();
};
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const requireClientId: RequestHandler = (req, _res, next) => {
  const clientId = req.get('x-client-id')?.trim();
  if (!clientId || !UUID_PATTERN.test(clientId)) {
    return next(
      AppError.badRequest('A valid X-Client-Id header (UUID v4) is required for wishlist routes'),
    );
  }
  req.userId = clientId.toLowerCase();
  next();
};
const counter = new FixedWindowCounter(config.RATE_LIMIT_PER_MIN, 60_000);
setInterval(() => counter.prune(), 60_000).unref();
export const rateLimit: RequestHandler = (req, res, next) => {
  const key = req.get('x-client-id') ?? req.ip ?? 'unknown';
  const result = counter.check(key);
  res.setHeader('x-ratelimit-limit', String(config.RATE_LIMIT_PER_MIN));
  res.setHeader('x-ratelimit-remaining', String(result.remaining));
  res.setHeader('x-ratelimit-reset', String(Math.ceil(result.resetAt / 1000)));
  if (!result.allowed) {
    const retryAfterSec = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    return next(
      new AppError('RATE_LIMITED', 'Too many requests — slow down a moment', { retryAfterSec }),
    );
  }
  next();
};
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
};
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) return next(error);
  if (error instanceof Error && error.name === 'AbortError') {
    logger.debug('http.aborted', { id: req.id, path: req.originalUrl });
    res.end();
    return;
  }
  const appError = toAppError(error);
  if (appError.status >= 500) {
    logger.error('http.error', {
      id: req.id,
      code: appError.code,
      message: appError.message,
      stack: config.isProduction ? undefined : appError.stack,
    });
  }
  if (appError.retryAfterSec) {
    res.setHeader('retry-after', String(appError.retryAfterSec));
  }
  res.status(appError.status).json({
    error: {
      code: appError.code,
      message: appError.message,
      details: appError.details,
      requestId: req.id,
    },
  });
}
