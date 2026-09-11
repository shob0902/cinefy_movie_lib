// React Query hooks and cache keys for catalogue, detail, genres and trending.
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import { apiRequest } from './client';
import type { CatalogPage, GenreWithArtwork, MovieDetail, MovieSummary } from './types';
import { toApiParams, type CatalogParams } from '../lib/catalogParams';
export const queryKeys = {
  genres: ['genres'] as const,
  trending: (window: 'day' | 'week') => ['trending', window] as const,
  catalog: (params: CatalogParams) => ['catalog', toApiParams(params)] as const,
  movie: (id: number) => ['movie', id] as const,
  wishlist: (sort: string) => ['wishlist', sort] as const,
  wishlistIds: ['wishlist', 'ids'] as const,
};
export function useGenres() {
  return useQuery({
    queryKey: queryKeys.genres,
    queryFn: ({ signal }) => apiRequest<{ items: GenreWithArtwork[] }>('/genres', { signal }),
    staleTime: Infinity,
    select: (data) => data.items,
  });
}
export function useTrending(
  window: 'day' | 'week' = 'week',
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: queryKeys.trending(window),
    queryFn: ({ signal }) =>
      apiRequest<{ items: MovieSummary[] }>('/movies/trending', { params: { window }, signal }),
    staleTime: 10 * 60 * 1000,
    select: (data) => data.items,
    enabled: options.enabled ?? true,
  });
}
export function useCatalog(params: CatalogParams, options: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.catalog(params),
    queryFn: ({ pageParam, signal }) =>
      apiRequest<CatalogPage>('/movies', {
        params: { ...toApiParams(params), page: pageParam },
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    enabled: options.enabled ?? true,
  });
}
export function useMovieDetail(id: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.movie(id),
    queryFn: ({ signal }) =>
      apiRequest<{ movie: MovieDetail; meta: { degraded: boolean } }>(`/movies/${id}`, { signal }),
    staleTime: 10 * 60 * 1000,
    enabled: (options.enabled ?? true) && Number.isFinite(id) && id > 0,
  });
}
export function prefetchMovie(client: QueryClient, id: number) {
  return client.prefetchQuery({
    queryKey: queryKeys.movie(id),
    queryFn: ({ signal }) =>
      apiRequest<{ movie: MovieDetail; meta: { degraded: boolean } }>(`/movies/${id}`, { signal }),
    staleTime: 10 * 60 * 1000,
  });
}
