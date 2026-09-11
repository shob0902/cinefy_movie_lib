// Every image in the app: reserved box, srcset and placeholder fallback.
import { useState, type CSSProperties } from 'react';
import type { ImageSet } from '../api/types';
import styles from './Poster.module.css';
interface PosterProps {
  image: ImageSet | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  ratio?: string;
}
export function Poster({ image, alt, sizes, priority = false, className, ratio }: PosterProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const showPlaceholder = !image || failed;
  return (
    <div
      className={[styles.frame, className].filter(Boolean).join(' ')}
      style={ratio ? ({ '--poster-ratio': ratio } as CSSProperties) : undefined}
    >
      {image && !failed && (
        <img
          className={[styles.image, loaded ? styles.loaded : ''].join(' ')}
          src={image.medium}
          srcSet={image.srcSet}
          sizes={sizes ?? '(max-width: 600px) 45vw, (max-width: 1100px) 30vw, 220px'}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          draggable={false}
        />
      )}
      {showPlaceholder && (
        <div className={styles.placeholder} aria-hidden="true">
          <svg className={styles.placeholderIcon} viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v12h16V6H4Zm2 2h2v2H6V8Zm10 0h2v2h-2V8ZM6 14h2v2H6v-2Zm10 0h2v2h-2v-2Zm-6-4h4v4h-4v-4Z" />
          </svg>
          <span className={styles.placeholderText}>{alt}</span>
        </div>
      )}
    </div>
  );
}
