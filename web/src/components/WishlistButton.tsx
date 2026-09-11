// Toggles a film in the wishlist with optimistic feedback.
import { useEffect, useRef, useState } from 'react';
import type { MovieSummary } from '../api/types';
import { useToggleWishlist, useWishlistIds } from '../api/wishlist';
import { useToast } from './Toaster';
import styles from './WishlistButton.module.css';
interface WishlistButtonProps {
  movie: MovieSummary;
  variant?: 'icon' | 'labelled';
}
export function WishlistButton({ movie, variant = 'icon' }: WishlistButtonProps) {
  const { ids } = useWishlistIds();
  const toggle = useToggleWishlist();
  const toast = useToast();
  const saved = ids.has(movie.id);
  const [animate, setAnimate] = useState(false);
  const previous = useRef(saved);
  useEffect(() => {
    if (previous.current !== saved) {
      previous.current = saved;
      setAnimate(true);
      const timer = window.setTimeout(() => setAnimate(false), 280);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [saved]);
  const label = saved ? `Remove ${movie.title} from wishlist` : `Add ${movie.title} to wishlist`;
  return (
    <button
      type="button"
      className={[
        styles.button,
        variant === 'icon' ? styles.iconOnly : styles.labelled,
        saved ? styles.saved : '',
        animate ? styles.pop : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-pressed={saved}
      aria-label={variant === 'icon' ? label : undefined}
      title={label}
      disabled={toggle.isPending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle.mutate(
          { movie, saved },
          {
            onError: () =>
              toast.show(
                saved ? 'Could not remove that one. Try again.' : 'Could not save that one. Try again.',
                'error',
              ),
            onSuccess: () =>
              toast.show(saved ? `Removed ${movie.title}` : `Saved ${movie.title}`, 'success'),
          },
        );
      }}
    >
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 20.5 4.2 13a4.8 4.8 0 0 1 0-6.8 4.8 4.8 0 0 1 6.8 0l1 1 1-1a4.8 4.8 0 0 1 6.8 0 4.8 4.8 0 0 1 0 6.8Z"
          fill={saved ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
      {variant === 'labelled' && <span>{saved ? 'In your wishlist' : 'Add to wishlist'}</span>}
    </button>
  );
}
