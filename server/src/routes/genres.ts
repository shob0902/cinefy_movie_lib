// Genre list endpoint with representative artwork.
import { Router } from 'express';
import { asyncHandler } from '../middleware/index.js';
import { getGenresWithArtwork } from '../services/genreService.js';
export const genresRouter = Router();
genresRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const genres = await getGenresWithArtwork(req.abortSignal);
    res.setHeader('cache-control', 'no-cache');
    res.json({ items: genres });
  }),
);
