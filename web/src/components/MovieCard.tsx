// Memoised poster tile linking to a film, prefetching detail on hover.
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { prefetchMovie } from '../api/queries';
import type { MovieSummary } from '../api/types';
import { formatRating } from '../lib/format';
import { Poster } from './Poster';
import { WishlistButton } from './WishlistButton';
import styles from './MovieCard.module.css';
interface MovieCardProps {
  movie: MovieSummary;
  backTo?: string;
  priority?: boolean;
}
function MovieCardComponent({ movie, backTo, priority = false }: MovieCardProps) {
  const client = useQueryClient();
  const rating = formatRating(movie.rating);
  const year = movie.releaseYear;
  const genre = movie.genres[0]?.name;
  const warm = () => void prefetchMovie(client, movie.id);
  return (
    <article className={styles.card}>
      <Link
        to={`/movie/${movie.id}`}
        state={backTo ? { backTo } : undefined}
        className={styles.posterWrap}
        onMouseEnter={warm}
        onFocus={warm}
        onTouchStart={warm}
        aria-label={`${movie.title}${year ? `, ${year}` : ''}`}
      >
        <Poster
          image={movie.poster}
          alt={movie.title}
          className={styles.poster}
          priority={priority}
        />
        <span className={styles.overlay} aria-hidden="true" />
        {rating && (
          <span className={styles.rating}>
            <svg className={styles.star} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="m12 17.3-6.2 3.7 1.7-7L2 9.2l7.1-.6L12 2l2.9 6.6 7.1.6-5.5 4.8 1.7 7z" />
            </svg>
            {rating}
          </span>
        )}
      </Link>
      <div className={styles.action}>
        <WishlistButton movie={movie} />
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>
          <Link to={`/movie/${movie.id}`} state={backTo ? { backTo } : undefined}>
            {movie.title}
          </Link>
        </h3>
        <p className={styles.meta}>
          <span>{year ?? 'TBA'}</span>
          {genre && (
            <>
              <span className={styles.separator} aria-hidden="true">
                &middot;
              </span>
              <span className={styles.genre}>{genre}</span>
            </>
          )}
        </p>
      </div>
    </article>
  );
}
export const MovieCard = memo(MovieCardComponent);
