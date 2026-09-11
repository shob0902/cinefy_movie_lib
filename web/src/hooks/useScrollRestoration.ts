// Restores scroll position when returning to a list.
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
const store = new Map<string, number>();
export function useScrollRestoration(key: string, ready: boolean) {
  const location = useLocation();
  const storageKey = `${location.pathname}${location.search}::${key}`;
  useEffect(() => {
    if (!ready) return;
    const saved = store.get(storageKey);
    if (saved !== undefined) {
      const frame = requestAnimationFrame(() => window.scrollTo({ top: saved }));
      return () => cancelAnimationFrame(frame);
    }
    return undefined;
  }, [storageKey, ready]);
  useEffect(() => {
    const onScroll = () => store.set(storageKey, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      store.set(storageKey, window.scrollY);
      window.removeEventListener('scroll', onScroll);
    };
  }, [storageKey]);
}
