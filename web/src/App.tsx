// Route table plus the persistent header and footer.
import { Route, Routes } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { SiteFooter } from './components/SiteFooter';
import { BrowsePage } from './pages/BrowsePage';
import { MovieDetailPage } from './pages/MovieDetailPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { WishlistPage } from './pages/WishlistPage';
import styles from './App.module.css';
export function App() {
  return (
    <>
      <AppHeader />
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<BrowsePage />} />
          <Route path="/movie/:id" element={<MovieDetailPage />} />
          <Route path="/wishlist" element={<WishlistPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <SiteFooter />
    </>
  );
}
