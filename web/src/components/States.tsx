// Shared empty, error, spinner and notice states.
import type { ReactNode } from 'react';
import { ApiError } from '../api/client';
import styles from './States.module.css';
export function Spinner({ label }: { label?: string }) {
  return (
    <span className={styles.spinner} role="status">
      <span className={styles.ring} aria-hidden="true" />
      {label && <span>{label}</span>}
    </span>
  );
}
interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}
export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className={styles.state}>
      <span className={styles.icon} aria-hidden="true">
        {icon ?? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" strokeLinecap="round" />
          </svg>
        )}
      </span>
      <h2 className={styles.title}>{title}</h2>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.actions}>{action}</div>}
    </div>
  );
}
interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  secondaryAction?: ReactNode;
}
export function ErrorState({ error, onRetry, secondaryAction }: ErrorStateProps) {
  const apiError = error instanceof ApiError ? error : null;
  const message = apiError?.userMessage ?? 'Something went wrong on our side.';
  const canRetry = apiError ? apiError.isRetryable : true;
  return (
    <div className={styles.state}>
      <span className={styles.icon} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5.5" strokeLinecap="round" />
          <circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <h2 className={styles.title}>We hit a snag</h2>
      <p className={styles.description}>{message}</p>
      <div className={styles.actions}>
        {canRetry && onRetry && (
          <button type="button" className={styles.primary} onClick={onRetry}>
            Try again
          </button>
        )}
        {secondaryAction}
      </div>

      {apiError?.requestId && (
        <p className={styles.requestId}>Reference: {apiError.requestId}</p>
      )}
    </div>
  );
}
export function Notice({
  children,
  variant = 'info',
}: {
  children: ReactNode;
  variant?: 'info' | 'warning';
}) {
  return (
    <div
      className={[styles.notice, variant === 'warning' ? styles.noticeWarning : '']
        .filter(Boolean)
        .join(' ')}
      role="status"
    >
      {children}
    </div>
  );
}
