// Closing call to action plus copyright and footer links.
import { Link } from 'react-router-dom';
import styles from './SiteFooter.module.css';
export function SiteFooter() {
  return (
    <div className={styles.wrap}>
      <section className={styles.cta}>
        <h2 className={styles.ctaHeading}>Find your next watch</h2>
        <Link to="/" className={styles.ctaButton}>
          Start browsing
          <svg
            className={styles.ctaIcon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="square"
            aria-hidden="true"
          >
            <path d="M5 12h14M13 5l7 7-7 7" />
          </svg>
        </Link>
      </section>
      <footer className={styles.footer}>
        <span className={styles.copy}>&copy; {new Date().getFullYear()} Cinefy</span>
        <nav className={styles.links} aria-label="Footer">
          <Link className={styles.link} to="/">
            Discover
          </Link>
          <Link className={styles.link} to="/wishlist">
            Wishlist
          </Link>
          <a
            className={styles.link}
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noreferrer noopener"
          >
            TMDB
          </a>
        </nav>
      </footer>
    </div>
  );
}
