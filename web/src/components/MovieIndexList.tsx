// The wishlist rendered as a numbered index rather than a poster grid.
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchMovie } from '../api/queries';
import type { MovieSummary } from '../api/types';
import { formatRating } from '../lib/format';
import { WishlistButton } from './WishlistButton';
import styles from './MovieIndexList.module.css';
interface MovieIndexListProps {
  movies: MovieSummary[];
  backTo?: string;
}
export function MovieIndexList({ movies, backTo }: MovieIndexListProps) {
  const client = useQueryClient();
  return (
    <ol className={`${styles.list} onDark`}>
      {movies.map((movie, index) => {
        const rating = formatRating(movie.rating);
        const warm = () => void prefetchMovie(client, movie.id);
        return (
          <li
            key={movie.id}
            className={styles.row}
            onMouseEnter={warm}
            onTouchStart={warm}
          >
            <span className={styles.index} aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className={styles.body}>
              <h2 className={styles.title}>
                <Link
                  to={`/movie/${movie.id}`}
                  state={backTo ? { backTo } : undefined}
                  className={styles.titleLink}
                  onFocus={warm}
                >
                  {movie.title}
                </Link>
              </h2>
              <div className={styles.tags}>
                {rating && <span className={`${styles.tag} ${styles.tagAccent}`}>&#9733; {rating}</span>}
                {movie.releaseYear && <span className={styles.tag}>{movie.releaseYear}</span>}
                {movie.genres.slice(0, 3).map((genre) => (
                  <span className={styles.tag} key={genre.id}>
                    {genre.name}
                  </span>
                ))}
              </div>
            </div>
            <div className={styles.controls}>
              <WishlistButton movie={movie} />
              <svg
                className={styles.arrow}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
                aria-hidden="true"
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
export function MovieIndexListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={styles.list} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className={styles.skeletonRow} key={index}>
          <div className={styles.skeletonLine} />
        </div>
      ))}
    </div>
  );
}
