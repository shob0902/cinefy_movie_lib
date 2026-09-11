// One trending film presented as the landing recommendation.
import { Link } from 'react-router-dom';
import type { MovieSummary } from '../api/types';
import { formatRating } from '../lib/format';
import { WishlistButton } from './WishlistButton';
import styles from './HeroSpotlight.module.css';
export function HeroSpotlight({ movie }: { movie: MovieSummary }) {
  const rating = formatRating(movie.rating);
  return (
    <section className={`${styles.hero} onDark`} aria-labelledby="hero-title">
      {movie.backdrop && (
        <img
          className={styles.backdrop}
          src={movie.backdrop.large}
          srcSet={movie.backdrop.srcSet}
          sizes="100vw"
          alt=""
          loading="eager"
          decoding="async"
        />
      )}
      <div className={styles.scrim} aria-hidden="true" />
      <div className={styles.content}>
        <span className={styles.eyebrow}>Trending this week</span>
        <h2 className={styles.title} id="hero-title">
          {movie.title}
        </h2>
        <div className={styles.meta}>
          {rating && <span className={styles.rating}>★ {rating}</span>}
          {movie.releaseYear && <span>{movie.releaseYear}</span>}
          {movie.genres.slice(0, 3).map((genre) => (
            <span key={genre.id}>{genre.name}</span>
          ))}
        </div>
        {movie.overview && <p className={styles.overview}>{movie.overview}</p>}
        <div className={styles.actions}>
          <Link to={`/movie/${movie.id}`} className={styles.primary}>
            View details
          </Link>
          <WishlistButton movie={movie} variant="labelled" />
        </div>
      </div>
    </section>
  );
}
export function HeroSkeleton() {
  return <div className={`skeleton ${styles.skeleton}`} aria-hidden="true" />;
}
