// Decorative skewed marquee of trending titles and genre names.
import type { CSSProperties } from 'react';
import styles from './Marquee.module.css';
interface MarqueeProps {
  items: string[];
  secondary?: string[];
  speed?: number;
}
function Row({ items, reverse, speed }: { items: string[]; reverse?: boolean; speed: number }) {
  const group = (
    <div className={styles.group}>
      {items.map((item, index) => (
        <span className={styles.item} key={`${item}-${index}`}>
          {item}
          <span className={styles.dot}>&bull;</span>
        </span>
      ))}
    </div>
  );
  return (
    <div
      className={`${styles.row} ${reverse ? styles.reverse : ''}`}
      style={{ '--speed': `${speed}s` } as CSSProperties}
    >
      {group}
      {group}
    </div>
  );
}
export function Marquee({ items, secondary, speed = 38 }: MarqueeProps) {
  if (items.length === 0) return null;
  return (
    <section className={styles.section} aria-hidden="true">
      <div className={styles.rows}>
        <Row items={items} speed={speed} />
        <Row items={secondary ?? items} reverse speed={speed * 1.15} />
      </div>
    </section>
  );
}
