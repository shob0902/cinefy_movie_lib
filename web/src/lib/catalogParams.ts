// Reads and writes the browse filters held in the URL.
import { SORT_OPTIONS, type SortKey } from '../api/types';
export interface CatalogParams {
  q: string;
  genres: number[];
  sort: SortKey;
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
}
export const DEFAULT_CATALOG_PARAMS: CatalogParams = {
  q: '',
  genres: [],
  sort: 'relevance',
};
function readInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
export function fromSearchParams(search: URLSearchParams): CatalogParams {
  const sort = search.get('sort');
  return {
    q: search.get('q')?.slice(0, 120) ?? '',
    genres: (search.get('genres') ?? '')
      .split(',')
      .map((part) => Number(part))
      .filter((id) => Number.isInteger(id) && id > 0),
    sort: SORT_OPTIONS.includes(sort as SortKey) ? (sort as SortKey) : 'relevance',
    yearFrom: readInt(search.get('yearFrom')),
    yearTo: readInt(search.get('yearTo')),
    minRating: readInt(search.get('minRating')),
  };
}
export function toSearchParams(params: CatalogParams): URLSearchParams {
  const search = new URLSearchParams();
  if (params.q.trim()) search.set('q', params.q.trim());
  if (params.genres.length) search.set('genres', params.genres.join(','));
  if (params.sort !== 'relevance') search.set('sort', params.sort);
  if (params.yearFrom !== undefined) search.set('yearFrom', String(params.yearFrom));
  if (params.yearTo !== undefined) search.set('yearTo', String(params.yearTo));
  if (params.minRating !== undefined) search.set('minRating', String(params.minRating));
  return search;
}
export function hasActiveFilters(params: CatalogParams): boolean {
  return (
    params.genres.length > 0 ||
    params.sort !== 'relevance' ||
    params.yearFrom !== undefined ||
    params.yearTo !== undefined ||
    params.minRating !== undefined
  );
}
export function toApiParams(params: CatalogParams) {
  return {
    q: params.q.trim() || undefined,
    genres: params.genres.length ? params.genres.join(',') : undefined,
    sort: params.sort,
    yearFrom: params.yearFrom,
    yearTo: params.yearTo,
    minRating: params.minRating,
  };
}
