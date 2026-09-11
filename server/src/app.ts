// Builds the Express app: middleware, routes and error handling.
import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { AppError } from './lib/errors.js';
import { errorHandler, notFoundHandler, rateLimit, requestContext } from './middleware/index.js';
import { genresRouter } from './routes/genres.js';
import { healthRouter } from './routes/health.js';
import { moviesRouter } from './routes/movies.js';
import { wishlistRouter } from './routes/wishlist.js';
export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
        callback(new AppError('BAD_REQUEST', `Origin ${origin} is not allowed`));
      },
      allowedHeaders: ['content-type', 'x-client-id', 'x-request-id'],
      exposedHeaders: ['x-request-id', 'retry-after', 'x-ratelimit-remaining'],
      maxAge: 86_400,
    }),
  );
  app.use(express.json({ limit: '64kb' }));
  app.use(requestContext);
  app.use(rateLimit);
  app.use('/api/health', healthRouter);
  app.use('/api/genres', genresRouter);
  app.use('/api/movies', moviesRouter);
  app.use('/api/wishlist', wishlistRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
