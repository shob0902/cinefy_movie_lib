// Wishlist queries and optimistic add/remove mutations.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';
import { queryKeys } from './queries';
import type { MovieSummary, Paginated, WishlistEntry, WishlistSortKey } from './types';
export function useWishlistIds() {
  const query = useQuery({
    queryKey: queryKeys.wishlistIds,
    queryFn: ({ signal }) => apiRequest<{ ids: number[] }>('/wishlist/ids', { signal }),
    staleTime: 60 * 1000,
    select: (data) => new Set(data.ids),
  });
  return {
    ids: query.data ?? new Set<number>(),
    count: query.data?.size ?? 0,
    isLoading: query.isLoading,
  };
}
export function useWishlist(sort: WishlistSortKey) {
  return useQuery({
    queryKey: queryKeys.wishlist(sort),
    queryFn: ({ signal }) =>
      apiRequest<Paginated<WishlistEntry>>('/wishlist', {
        params: { sort, pageSize: 100 },
        signal,
      }),
    staleTime: 30 * 1000,
  });
}
interface ToggleInput {
  movie: MovieSummary;
  saved: boolean;
}
export function useToggleWishlist() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ movie, saved }: ToggleInput) => {
      if (saved) {
        await apiRequest<void>(`/wishlist/${movie.id}`, { method: 'DELETE' });
        return;
      }
      await apiRequest<WishlistEntry>('/wishlist', {
        method: 'POST',
        body: { movieId: movie.id, movie },
      });
    },
    onMutate: async ({ movie, saved }) => {
      await client.cancelQueries({ queryKey: queryKeys.wishlistIds });
      const previous = client.getQueryData<{ ids: number[] }>(queryKeys.wishlistIds);
      client.setQueryData<{ ids: number[] }>(queryKeys.wishlistIds, (current) => {
        const ids = new Set(current?.ids ?? []);
        if (saved) ids.delete(movie.id);
        else ids.add(movie.id);
        return { ids: [...ids] };
      });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        client.setQueryData(queryKeys.wishlistIds, context.previous);
      }
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });
}
