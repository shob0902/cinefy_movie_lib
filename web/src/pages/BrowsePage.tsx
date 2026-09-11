// Landing screen: masthead, spotlight, marquee, filters and results grid.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCatalog, useGenres, useTrending } from '../api/queries';
import { SORT_LABELS } from '../api/types';
import { FilterBar } from '../components/FilterBar';
import { GenreCarousel } from '../components/GenreCarousel';
import { HeroSkeleton, HeroSpotlight } from '../components/HeroSpotlight';
import { Marquee } from '../components/Marquee';
import { TypographicMasthead } from '../components/TypographicMasthead';
import { MovieGrid, MovieGridSkeleton } from '../components/MovieGrid';
import { EmptyState, ErrorState, Notice } from '../components/States';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import {
  DEFAULT_CATALOG_PARAMS,
  fromSearchParams,
  hasActiveFilters,
  toSearchParams,
  type CatalogParams,
} from '../lib/catalogParams';
import styles from './BrowsePage.module.css';
const numberFormat = new Intl.NumberFormat();
export function BrowsePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => fromSearchParams(searchParams), [searchParams]);
  const [searchInput, setSearchInput] = useState(params.q);
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const pushedQuery = useRef(params.q);
  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    if (trimmed === paramsRef.current.q) return;
    pushedQuery.current = trimmed;
    setSearchParams(toSearchParams({ ...paramsRef.current, q: trimmed }), { replace: true });
  }, [debouncedSearch, setSearchParams]);
  useEffect(() => {
    if (params.q !== pushedQuery.current) {
      pushedQuery.current = params.q;
      setSearchInput(params.q);
    }
  }, [params.q]);
  const updateParams = (patch: Partial<CatalogParams>) => {
    const next = { ...params, ...patch };
    pushedQuery.current = next.q;
    setSearchParams(toSearchParams(next));
  };
  const reset = () => {
    pushedQuery.current = '';
    setSearchInput('');
    setSearchParams(toSearchParams(DEFAULT_CATALOG_PARAMS), { replace: true });
  };
  const genresQuery = useGenres();
  const catalog = useCatalog(params);
  const isBrowsingDefault = !params.q.trim() && !hasActiveFilters(params);
  const trending = useTrending('week', { enabled: isBrowsingDefault });
  const movies = useMemo(
    () => catalog.data?.pages.flatMap((page) => page.items) ?? [],
    [catalog.data],
  );
  const lastPage = catalog.data?.pages.at(-1);
  const meta = lastPage?.meta;
  useScrollRestoration('browse', movies.length > 0);
  const summary = (() => {
    if (!lastPage) return undefined;
    if (meta?.mode === 'search-window' && meta.windowedResults) {
      const { scannedItems, upstreamTotal } = meta.windowedResults;
      return `Sorted and filtered across the ${numberFormat.format(scannedItems)} most relevant of ${numberFormat.format(upstreamTotal)} matches`;
    }
    const total = lastPage.totalItems;
    if (total === 0) return undefined;
    return `${numberFormat.format(total)} ${total === 1 ? 'film' : 'films'} · ${
      params.sort === 'relevance' && !params.q.trim() ? 'Popular now' : SORT_LABELS[params.sort]
    }`;
  })();
  const spotlight = trending.data?.[0];
  const marqueeTitles = useMemo(() => {
    const titles = (trending.data ?? []).slice(0, 10).map((movie) => movie.title);
    return titles.length > 0 ? titles : ['Now Trending', 'This Week', 'On Cinefy'];
  }, [trending.data]);
  const marqueeGenres = useMemo(() => {
    const names = (genresQuery.data ?? []).slice(0, 12).map((genre) => genre.name);
    return names.length > 0 ? names : ['Every Genre', 'Every Year', 'Every Mood'];
  }, [genresQuery.data]);
  return (
    <div className={`page ${styles.page}`}>
      {isBrowsingDefault && (
        <>
          <TypographicMasthead
            headline="Cinefy"
            label={['Built on', 'The Movie Database']}
            role={['Browse. Filter.', 'Keep the good ones.']}
          />
          <div className={styles.hero}>
            {trending.isLoading ? (
              <HeroSkeleton />
            ) : spotlight ? (
              <HeroSpotlight movie={spotlight} />
            ) : null}
          </div>
          <div className={styles.band}>
            <Marquee items={marqueeTitles} secondary={marqueeGenres} />
          </div>
        </>
      )}
      <FilterBar
        searchInput={searchInput}
        onSearchInput={setSearchInput}
        params={params}
        onChange={updateParams}
        onReset={reset}
        isFetching={catalog.isFetching && !catalog.isFetchingNextPage}
        resultSummary={summary}
      />
      <GenreCarousel
        genres={genresQuery.data ?? []}
        isLoading={genresQuery.isLoading}
        selectedIds={params.genres}
        onToggle={(id) =>
          updateParams({
            genres: params.genres.includes(id)
              ? params.genres.filter((genreId) => genreId !== id)
              : [...params.genres, id],
          })
        }
        onClear={() => updateParams({ genres: [] })}
      />
      <div className={styles.notices}>
        {meta?.degraded && (
          <Notice variant="warning">
            The movie service is unavailable right now — showing the most recent results we have.
          </Notice>
        )}
      </div>
      {catalog.isLoading ? (
        <MovieGridSkeleton count={18} />
      ) : catalog.isError ? (
        <ErrorState error={catalog.error} onRetry={() => void catalog.refetch()} />
      ) : movies.length === 0 ? (
        <EmptyState
          title={params.q.trim() ? `No films match “${params.q.trim()}”` : 'Nothing matches those filters'}
          description={
            params.q.trim()
              ? 'Check the spelling, or try a shorter search — partial titles usually work better.'
              : 'Try widening the year range or removing a genre.'
          }
          action={
            (params.q.trim() || hasActiveFilters(params)) && (
              <button type="button" onClick={reset} className="linkButton">
                Clear search and filters
              </button>
            )
          }
        />
      ) : (
        <MovieGrid
          movies={movies}
          backTo={`/${searchParams.toString() ? `?${searchParams}` : ''}`}
          isPending={catalog.isPlaceholderData}
          hasMore={catalog.hasNextPage}
          isLoadingMore={catalog.isFetchingNextPage}
          onLoadMore={() => void catalog.fetchNextPage()}
          endMessage={
            meta?.mode === 'search-window'
              ? 'That is everything in this result window.'
              : 'You have reached the end.'
          }
        />
      )}
    </div>
  );
}
