// Fires a callback when a sentinel element scrolls into view.
import { useEffect, useRef } from 'react';
interface Options {
  onLoadMore: () => void;
  enabled: boolean;
  rootMargin?: string;
}
export function useInfiniteScroll<T extends HTMLElement>({
  onLoadMore,
  enabled,
  rootMargin = '600px',
}: Options) {
  const sentinelRef = useRef<T | null>(null);
  const callbackRef = useRef(onLoadMore);
  callbackRef.current = onLoadMore;
  useEffect(() => {
    const element = sentinelRef.current;
    if (!element || !enabled) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) callbackRef.current();
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);
  return sentinelRef;
}
