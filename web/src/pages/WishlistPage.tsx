// Saved films, sortable, served entirely from our own database.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWishlist } from '../api/wishlist';
import { WISHLIST_SORT_LABELS, WISHLIST_SORTS, type WishlistSortKey } from '../api/types';
import { MovieIndexList, MovieIndexListSkeleton } from '../components/MovieIndexList';
import { EmptyState, ErrorState } from '../components/States';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import styles from './WishlistPage.module.css';
export function WishlistPage() {
  const [sort, setSort] = useState<WishlistSortKey>('added_desc');
  const query = useWishlist(sort);
  const entries = query.data?.items ?? [];
  useScrollRestoration('wishlist', entries.length > 0);
  const total = query.data?.totalItems ?? 0;
  return (
    <div className={`page ${styles.page}`}>
      <div className={styles.header}>
        <div className={styles.headings}>
          <h1 className={styles.title}>Your wishlist</h1>
          <p className={styles.subtitle}>
            {query.isLoading
              ? 'Loading your saved films…'
              : total === 0
                ? 'Nothing saved yet.'
                : `${total} ${total === 1 ? 'film' : 'films'} saved`}
          </p>
        </div>
        {total > 1 && (
          <>
            <label className="srOnly" htmlFor="wishlist-sort">
              Sort wishlist
            </label>
            <select
              id="wishlist-sort"
              className={styles.select}
              value={sort}
              onChange={(event) => setSort(event.target.value as WishlistSortKey)}
            >
              {WISHLIST_SORTS.map((option) => (
                <option key={option} value={option}>
                  {WISHLIST_SORT_LABELS[option]}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      {query.isLoading ? (
        <MovieIndexListSkeleton count={8} />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M12 20.5 4.2 13a4.8 4.8 0 0 1 0-6.8 4.8 4.8 0 0 1 6.8 0l1 1 1-1a4.8 4.8 0 0 1 6.8 0 4.8 4.8 0 0 1 0 6.8Z" />
            </svg>
          }
          title="Your wishlist is empty"
          description="Tap the heart on any poster to keep it here. It stays saved on this device, even after you close the app."
          action={
            <Link to="/" className="linkButton">
              Find something to watch
            </Link>
          }
        />
      ) : (
        <>
          <MovieIndexList movies={entries.map((entry) => entry.movie)} backTo="/wishlist" />
          {total > 12 && <p className={styles.end}>That is your whole list.</p>}
        </>
      )}
    </div>
  );
}
