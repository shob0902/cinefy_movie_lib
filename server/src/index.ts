// Server entry point: starts the listener and handles shutdown.
import { config } from './config/env.js';
import { createApp } from './app.js';
import { createCacheRepository } from './db/cacheRepository.js';
import { closeDb, getDb } from './db/index.js';
import { logger } from './lib/logger.js';
import { tmdbCache } from './tmdb/client.js';
import { refreshImageConfig } from './tmdb/images.js';
async function main() {
  getDb();
  const cacheRepository = createCacheRepository();
  tmdbCache.attachPersistentTier(cacheRepository);
  if (config.tmdbAuth.kind === 'none') {
    logger.warn('tmdb.not_configured', {
      hint: 'Copy server/.env.example to server/.env and add TMDB_ACCESS_TOKEN. Movie endpoints will return 503 until then.',
    });
  } else {
    void refreshImageConfig();
  }
  const server = createApp().listen(config.PORT, () => {
    logger.info('server.listening', {
      port: config.PORT,
      env: config.NODE_ENV,
      origins: config.corsOrigins,
    });
  });
  const purgeTimer = setInterval(() => cacheRepository.purgeExpired(), 60 * 60 * 1000).unref();
  const configTimer = setInterval(() => void refreshImageConfig(), 24 * 60 * 60 * 1000).unref();
  const shutdown = (signal: string) => {
    logger.info('server.shutdown', { signal });
    clearInterval(purgeTimer);
    clearInterval(configTimer);
    server.close(() => {
      closeDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    logger.error('process.unhandled_rejection', { reason: String(reason) });
  });
}
main().catch((error) => {
  logger.error('server.start_failed', { error: String(error) });
  process.exit(1);
});
