// Paged poster grid with infinite scroll and an explicit load-more button.
import type { MovieSummary } from '../api/types';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { MovieCard } from './MovieCard';
import { Spinner } from './States';
import styles from './MovieGrid.module.css';
export function MovieGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className={styles.grid} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>
          <div className={`skeleton ${styles.skeletonPoster}`} />
          <div className={styles.skeletonBody}>
            <div className={`skeleton ${styles.skeletonLine}`} style={{ width: '80%' }} />
            <div className={`skeleton ${styles.skeletonLine}`} style={{ width: '45%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}
interface MovieGridProps {
  movies: MovieSummary[];
  backTo?: string;
  isPending?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  endMessage?: string;
}
export function MovieGrid({
  movies,
  backTo,
  isPending = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  endMessage,
}: MovieGridProps) {
  const sentinelRef = useInfiniteScroll<HTMLDivElement>({
    enabled: Boolean(hasMore && onLoadMore && !isLoadingMore),
    onLoadMore: () => onLoadMore?.(),
  });
  return (
    <>
      <div className={[styles.grid, isPending ? styles.pending : ''].filter(Boolean).join(' ')}>
        {movies.map((movie, index) => (
          <MovieCard
            key={movie.id}
            movie={movie}
            backTo={backTo}
            priority={index < 6}
          />
        ))}
      </div>
      {onLoadMore && <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />}
      <div className={styles.footer}>
        {isLoadingMore && <Spinner label="Loading more films" />}
        {hasMore && onLoadMore && !isLoadingMore && (
          <button type="button" className={styles.loadMore} onClick={onLoadMore}>
            Load more
          </button>
        )}
        {!hasMore && movies.length > 0 && endMessage && (
          <p className={styles.end}>{endMessage}</p>
        )}
      </div>
    </>
  );
}
