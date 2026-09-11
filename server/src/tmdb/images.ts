// Builds absolute image URLs from TMDB's published configuration.
import { config } from '../config/env.js';
import { logger } from '../lib/logger.js';
import type { ImageSet } from '../domain/movie.js';
import { tmdbGet } from './client.js';
import { tmdbConfigurationSchema } from './schemas.js';
const FALLBACK = {
  baseUrl: config.TMDB_IMAGE_BASE_URL,
  posterSizes: ['w185', 'w342', 'w500', 'w780', 'original'],
  backdropSizes: ['w300', 'w780', 'w1280', 'original'],
  profileSizes: ['w45', 'w185', 'h632', 'original'],
};
type ImageConfig = typeof FALLBACK;
let current: ImageConfig = FALLBACK;
const ASPECT = { poster: 2 / 3, backdrop: 16 / 9, profile: 2 / 3 } as const;
function pickSizes(available: string[], preferred: [string, string, string]): [string, string, string] {
  const has = (size: string) => available.includes(size);
  const fallbackLargest = available.at(-1) ?? 'original';
  return [
    has(preferred[0]) ? preferred[0] : (available[0] ?? fallbackLargest),
    has(preferred[1]) ? preferred[1] : (available[Math.floor(available.length / 2)] ?? fallbackLargest),
    has(preferred[2]) ? preferred[2] : fallbackLargest,
  ];
}
function widthOf(size: string, fallback: number): number {
  const match = /^w(\d+)$/.exec(size);
  return match?.[1] ? Number(match[1]) : fallback;
}
export function buildImageSet(
  path: string | null,
  kind: 'poster' | 'backdrop' = 'poster',
): ImageSet | null {
  if (!path) return null;
  const normalised = path.startsWith('/') ? path : `/${path}`;
  const sizes =
    kind === 'poster'
      ? pickSizes(current.posterSizes, ['w185', 'w342', 'w500'])
      : pickSizes(current.backdropSizes, ['w300', 'w780', 'w1280']);
  const defaults = kind === 'poster' ? [185, 342, 500] : [300, 780, 1280];
  const urls = sizes.map((size) => `${current.baseUrl}/${size}${normalised}`) as [
    string,
    string,
    string,
  ];
  const widths = sizes.map((size, index) => widthOf(size, defaults[index] ?? 500));
  return {
    small: urls[0],
    medium: urls[1],
    large: urls[2],
    srcSet: urls.map((url, index) => `${url} ${widths[index]}w`).join(', '),
    aspectRatio: ASPECT[kind],
  };
}
export function buildProfileUrl(path: string | null): string | null {
  if (!path) return null;
  const normalised = path.startsWith('/') ? path : `/${path}`;
  const size = current.profileSizes.includes('w185') ? 'w185' : (current.profileSizes[0] ?? 'original');
  return `${current.baseUrl}/${size}${normalised}`;
}
export async function refreshImageConfig(): Promise<void> {
  try {
    const { data } = await tmdbGet<unknown>('/configuration', {}, {
      ttlMs: config.CACHE_TTL_CONFIG_SEC * 1000,
    });
    const parsed = tmdbConfigurationSchema.safeParse(data);
    if (!parsed.success) return;
    const images = parsed.data.images;
    current = {
      baseUrl: (images.secure_base_url ?? FALLBACK.baseUrl).replace(/\/$/, ''),
      posterSizes: images.poster_sizes.length ? images.poster_sizes : FALLBACK.posterSizes,
      backdropSizes: images.backdrop_sizes.length ? images.backdrop_sizes : FALLBACK.backdropSizes,
      profileSizes: images.profile_sizes.length ? images.profile_sizes : FALLBACK.profileSizes,
    };
    logger.info('tmdb.image_config_loaded', { baseUrl: current.baseUrl });
  } catch (error) {
    logger.warn('tmdb.image_config_failed', { error: String(error) });
  }
}
