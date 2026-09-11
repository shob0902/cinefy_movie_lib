// Liveness plus cache, breaker and upstream statistics.
import { Router } from 'express';
import { config } from '../config/env.js';
import { tmdbStats } from '../tmdb/client.js';
export const healthRouter = Router();
const startedAt = Date.now();
healthRouter.get('/', (_req, res) => {
  const stats = tmdbStats();
  res.setHeader('cache-control', 'no-store');
  res.json({
    status: stats.breaker.state === 'open' ? 'degraded' : 'ok',
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    environment: config.NODE_ENV,
    tmdbConfigured: config.tmdbAuth.kind !== 'none',
    upstream: stats.breaker,
    cache: stats.cache,
    upstreamRequests: stats.upstreamRequests,
  });
});
