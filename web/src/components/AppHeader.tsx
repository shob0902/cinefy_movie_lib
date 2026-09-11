// Top navigation: brand, pill links, wishlist count and offline notice.
import { NavLink } from 'react-router-dom';
import { useWishlistIds } from '../api/wishlist';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import styles from './AppHeader.module.css';
const linkClass = ({ isActive }: { isActive: boolean }) =>
  [styles.link, isActive ? styles.active : ''].filter(Boolean).join(' ');
export function AppHeader() {
  const { count } = useWishlistIds();
  const online = useOnlineStatus();
  return (
    <>
      {!online && (
        <div className={styles.offline} role="alert">
          You are offline — showing what we already have.
        </div>
      )}
      <header className={styles.header}>
        <div className={styles.inner}>
          <NavLink to="/" className={styles.brand} aria-label="Cinefy home">
            <span className={styles.mark} aria-hidden="true">
              C
            </span>
            <span className={styles.brandText}>Cinefy</span>
          </NavLink>
          <nav className={styles.nav} aria-label="Main">
            <NavLink to="/" end className={linkClass}>
              <svg className={styles.linkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <path d="M3 9h18M8 4v5M16 4v5" />
              </svg>
              <span className={styles.linkLabel}>Discover</span>
            </NavLink>
            <NavLink to="/wishlist" className={linkClass}>
              <svg className={styles.linkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                <path d="M12 20.5 4.2 13a4.8 4.8 0 0 1 0-6.8 4.8 4.8 0 0 1 6.8 0l1 1 1-1a4.8 4.8 0 0 1 6.8 0 4.8 4.8 0 0 1 0 6.8Z" />
              </svg>
              <span className={styles.linkLabel}>Wishlist</span>
              {count > 0 && (
                <span className={styles.badge} aria-label={`${count} saved`}>
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </NavLink>
          </nav>
          <a
            className={styles.source}
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noreferrer noopener"
          >
            Data // TMDB
          </a>
        </div>
      </header>
    </>
  );
}
