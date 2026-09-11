// Circular "scroll down" dial built on an SVG textPath.
import styles from './ScrollIndicator.module.css';
export function ScrollIndicator({ label = 'Scroll Down' }: { label?: string }) {
  const text = `${label} \u2022 `.repeat(4);
  return (
    <div className={styles.indicator} aria-hidden="true">
      <svg className={styles.ring} viewBox="0 0 144 144">
        <defs>

          <path id="scroll-ring" d="M72,72 m0,-58 a58,58 0 1,1 0,116 a58,58 0 1,1 0,-116" fill="none" />
        </defs>
        <text className={styles.ringText}>
          <textPath href="#scroll-ring" startOffset="0">
            {text}
          </textPath>
        </text>
      </svg>
      <svg
        className={styles.arrow}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="square"
      >
        <path d="M12 4v16M5 13l7 7 7-7" />
      </svg>
    </div>
  );
}
