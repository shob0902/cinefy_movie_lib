// Horizontal rails for related films and top-billed cast.
import type { CastMember, MovieSummary } from '../api/types';
import { MovieCard } from './MovieCard';
import styles from './MovieRow.module.css';
export function MovieRow({ title, movies }: { title: string; movies: MovieSummary[] }) {
  if (movies.length === 0) return null;
  return (
    <section className={styles.section} aria-label={title}>
      <h2 className={styles.heading}>{title}</h2>
      <div className={styles.scroller}>
        {movies.map((movie) => (
          <div key={movie.id} className={styles.item}>
            <MovieCard movie={movie} />
          </div>
        ))}
      </div>
    </section>
  );
}
function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}
export function CastRow({ cast }: { cast: CastMember[] }) {
  if (cast.length === 0) return null;
  return (
    <section className={styles.section} aria-label="Top billed cast">
      <h2 className={styles.heading}>Cast</h2>
      <div className={styles.scroller}>
        {cast.map((member) => (
          <div key={member.id} className={styles.person}>
            {member.profileUrl ? (
              <img
                className={styles.avatar}
                src={member.profileUrl}
                alt={member.name}
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className={[styles.avatar, styles.avatarFallback].join(' ')} aria-hidden="true">
                {initials(member.name)}
              </div>
            )}
            <span className={styles.personName}>{member.name}</span>
            {member.character && <span className={styles.personRole}>{member.character}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
