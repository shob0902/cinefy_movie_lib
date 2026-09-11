// Single film: artwork, facts, overview, cast and recommendations.
import { useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMovieDetail } from '../api/queries';
import { CastRow, MovieRow } from '../components/MovieRow';
import { Poster } from '../components/Poster';
import { EmptyState, ErrorState, Notice } from '../components/States';
import { WishlistButton } from '../components/WishlistButton';
import {
  formatCurrency,
  formatLanguage,
  formatRating,
  formatReleaseDate,
  formatRuntime,
  formatCompactNumber,
} from '../lib/format';
import styles from './MovieDetailPage.module.css';
function BackLink({ to, inline }: { to: string; inline: boolean }) {
  return (
    <Link
      to={to}
      className={[styles.back, inline ? styles.backInline : ''].filter(Boolean).join(' ')}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <path d="M15 6 9 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Back
    </Link>
  );
}
function DetailSkeleton() {
  return (
    <div className={`page ${styles.page}`} aria-hidden="true">
      <div className={`skeleton ${styles.skelBackdrop}`} />
      <div className={styles.header}>
        <div className={`skeleton ${styles.poster}`} style={{ aspectRatio: '2 / 3' }} />
        <div className={styles.headerBody}>
          <div className={`skeleton ${styles.skelLine}`} style={{ width: '55%', height: 30 }} />
          <div className={`skeleton ${styles.skelLine}`} style={{ width: '35%' }} />
          <div className={`skeleton ${styles.skelLine}`} style={{ width: '70%' }} />
        </div>
      </div>
    </div>
  );
}
export function MovieDetailPage() {
  const { id } = useParams<{ id: string }>();
  const movieId = Number(id);
  const location = useLocation();
  const navigate = useNavigate();
  const backTo = (location.state as { backTo?: string } | null)?.backTo ?? '/';
  const query = useMovieDetail(movieId);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [movieId]);
  if (!Number.isFinite(movieId) || movieId <= 0) {
    return (
      <div className="page">
        <EmptyState
          title="That does not look like a film"
          description="The link may be incomplete or mistyped."
          action={
            <button type="button" className="linkButton" onClick={() => navigate('/')}>
              Back to discover
            </button>
          }
        />
      </div>
    );
  }
  if (query.isLoading) return <DetailSkeleton />;
  if (query.isError) {
    return (
      <div className="page">
        <ErrorState
          error={query.error}
          onRetry={() => void query.refetch()}
          secondaryAction={
            <Link to={backTo} className="linkButton">
              Go back
            </Link>
          }
        />
      </div>
    );
  }
  const movie = query.data?.movie;
  if (!movie) return null;
  const runtime = formatRuntime(movie.runtimeMinutes);
  const rating = formatRating(movie.rating);
  const released = formatReleaseDate(movie.releaseDate);
  const facts: Array<[string, string | null]> = [
    ['Status', movie.status],
    ['Released', released],
    ['Runtime', runtime],
    ['Original language', formatLanguage(movie.originalLanguage)],
    ['Budget', formatCurrency(movie.budget)],
    ['Revenue', formatCurrency(movie.revenue)],
    ['Production', movie.productionCompanies.slice(0, 3).join(', ') || null],
    ['Countries', movie.productionCountries.slice(0, 3).join(', ') || null],
  ];
  return (
    <div className={`page ${styles.page}`}>
      {movie.backdrop ? (
        <div className={styles.backdropWrap}>
          <img
            className={styles.backdrop}
            src={movie.backdrop.large}
            srcSet={movie.backdrop.srcSet}
            sizes="100vw"
            alt=""
            loading="eager"
            decoding="async"
          />
          <div className={styles.backdropScrim} aria-hidden="true" />
          <BackLink to={backTo} inline={false} />
        </div>
      ) : (
        <BackLink to={backTo} inline />
      )}
      {query.data?.meta.degraded && (
        <Notice variant="warning">
          Showing cached details — the movie service is not responding right now.
        </Notice>
      )}
      <header className={styles.header}>
        <Poster
          image={movie.poster}
          alt={movie.title}
          className={styles.poster}
          sizes="(max-width: 720px) 42vw, 240px"
          priority
        />
        <div className={styles.headerBody}>
          <h1 className={styles.title}>{movie.title}</h1>

          {movie.originalTitle && movie.originalTitle !== movie.title && (
            <p className={styles.originalTitle}>{movie.originalTitle}</p>
          )}
          {movie.tagline && <p className={styles.tagline}>“{movie.tagline}”</p>}
          <div className={styles.facts}>
            {rating && (
              <span className={styles.score}>
                ★ {rating}
                <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                  ({formatCompactNumber(movie.voteCount)})
                </span>
              </span>
            )}
            {movie.releaseYear && <span>{movie.releaseYear}</span>}
            {runtime && <span>{runtime}</span>}
          </div>
          {movie.genres.length > 0 && (
            <div className={styles.genreList}>
              {movie.genres.map((genre) => (
                <Link key={genre.id} to={`/?genres=${genre.id}`} className={styles.genreTag}>
                  {genre.name}
                </Link>
              ))}
            </div>
          )}
          <div className={styles.actions}>
            <WishlistButton movie={movie} variant="labelled" />
            {movie.trailer && (
              <a
                className={styles.trailerLink}
                href={movie.trailer.url}
                target="_blank"
                rel="noreferrer noopener"
              >
                <svg className={styles.playIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5.5v13l11-6.5z" />
                </svg>
                Watch trailer
              </a>
            )}
          </div>
        </div>
      </header>
      <div className={styles.body}>
        <div className={styles.rows}>
          {movie.overview && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Overview</h2>
              <p className={styles.overview}>{movie.overview}</p>
            </section>
          )}
          <CastRow cast={movie.cast} />
          <MovieRow title="More like this" movies={movie.recommendations} />
        </div>
        <aside className={styles.aside}>
          {(movie.directors.length > 0 || movie.writers.length > 0) && (
            <>
              {movie.directors.length > 0 && (
                <div className={styles.factRow}>
                  <span className={styles.factLabel}>
                    {movie.directors.length > 1 ? 'Directors' : 'Director'}
                  </span>
                  <span className={styles.factValue}>
                    {movie.directors.map((person) => person.name).join(', ')}
                  </span>
                </div>
              )}
              {movie.writers.length > 0 && (
                <div className={styles.factRow}>
                  <span className={styles.factLabel}>Writing</span>
                  <span className={styles.factValue}>
                    {movie.writers.map((person) => person.name).join(', ')}
                  </span>
                </div>
              )}
            </>
          )}

          {facts
            .filter((entry): entry is [string, string] => Boolean(entry[1]))
            .map(([label, value]) => (
              <div className={styles.factRow} key={label}>
                <span className={styles.factLabel}>{label}</span>
                <span className={styles.factValue}>{value}</span>
              </div>
            ))}
        </aside>
      </div>
    </div>
  );
}
