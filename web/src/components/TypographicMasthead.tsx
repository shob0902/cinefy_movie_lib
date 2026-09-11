// Landing masthead: headline, rule, label, dial and role.
import { ScrollIndicator } from './ScrollIndicator';
import styles from './TypographicMasthead.module.css';
interface TypographicMastheadProps {
  headline: string;
  label: [string, string];
  role: [string, string];
}
export function TypographicMasthead({ headline, label, role }: TypographicMastheadProps) {
  return (
    <header className={styles.masthead}>
      <h1 className={styles.headline}>{headline}</h1>
      <div className={styles.rule} />
      <div className={styles.meta}>
        <p className={styles.metaLabel}>
          {label[0]}
          <span>{label[1]}</span>
        </p>
        <div className={styles.dial}>
          <ScrollIndicator />
        </div>
        <p className={styles.role}>
          <span>{role[0]}</span>
          <span className={styles.roleMuted}>{role[1]}</span>
        </p>
      </div>
    </header>
  );
}
