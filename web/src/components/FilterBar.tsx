// Search box, sort select and the advanced year/rating filter panel.
import { useId, useState } from 'react';
import { SORT_LABELS, SORT_OPTIONS, type SortKey } from '../api/types';
import { hasActiveFilters, type CatalogParams } from '../lib/catalogParams';
import { Spinner } from './States';
import styles from './FilterBar.module.css';
const CURRENT_YEAR = new Date().getFullYear();
interface FilterBarProps {
  searchInput: string;
  onSearchInput: (value: string) => void;
  params: CatalogParams;
  onChange: (patch: Partial<CatalogParams>) => void;
  onReset: () => void;
  isFetching: boolean;
  resultSummary?: string;
}
export function FilterBar({
  searchInput,
  onSearchInput,
  params,
  onChange,
  onReset,
  isFetching,
  resultSummary,
}: FilterBarProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const panelId = useId();
  const sortId = useId();
  const activeFilterCount =
    params.genres.length +
    (params.yearFrom !== undefined || params.yearTo !== undefined ? 1 : 0) +
    (params.minRating !== undefined ? 1 : 0);
  const parseYear = (value: string): number | undefined => {
    if (!value.trim()) return undefined;
    const year = Number(value);
    return Number.isInteger(year) && year >= 1874 && year <= CURRENT_YEAR + 5 ? year : undefined;
  };
  return (
    <div className={styles.bar}>
      <div className={styles.row}>
        <div className={styles.search}>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" strokeLinecap="round" />
          </svg>
          <input
            className={styles.input}
            type="search"
            value={searchInput}
            onChange={(event) => onSearchInput(event.target.value)}
            placeholder="Search films by title…"
            aria-label="Search films"
            autoComplete="off"
            spellCheck={false}
            maxLength={120}
          />
          {isFetching && (
            <span className={styles.busy}>
              <Spinner />
            </span>
          )}
          {searchInput && (
            <button
              type="button"
              className={styles.clearSearch}
              onClick={() => onSearchInput('')}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>
        <label className="srOnly" htmlFor={sortId}>
          Sort results
        </label>
        <select
          id={sortId}
          className={styles.select}
          value={params.sort}
          onChange={(event) => onChange({ sort: event.target.value as SortKey })}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option} value={option}>

              {option === 'relevance' && !params.q.trim() ? 'Popular now' : SORT_LABELS[option]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={[styles.toggle, panelOpen || activeFilterCount ? styles.toggleActive : '']
            .filter(Boolean)
            .join(' ')}
          onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen}
          aria-controls={panelId}
        >
          Filters
          {activeFilterCount > 0 && <span className={styles.count}>{activeFilterCount}</span>}
        </button>
      </div>
      {panelOpen && (
        <div className={styles.panel} id={panelId}>
          <div className={styles.field}>
            <span className={styles.label}>Release years</span>
            <div className={styles.yearInputs}>
              <input
                className={styles.number}
                type="number"
                inputMode="numeric"
                min={1874}
                max={CURRENT_YEAR + 5}
                placeholder="From"
                aria-label="Release year from"
                value={params.yearFrom ?? ''}
                onChange={(event) => onChange({ yearFrom: parseYear(event.target.value) })}
              />
              <span aria-hidden="true">–</span>
              <input
                className={styles.number}
                type="number"
                inputMode="numeric"
                min={1874}
                max={CURRENT_YEAR + 5}
                placeholder="To"
                aria-label="Release year to"
                value={params.yearTo ?? ''}
                onChange={(event) => onChange({ yearTo: parseYear(event.target.value) })}
              />
            </div>
          </div>
          <div className={styles.field}>
            <span className={styles.label}>Minimum rating</span>
            <input
              className={styles.range}
              type="range"
              min={0}
              max={9}
              step={1}
              value={params.minRating ?? 0}
              aria-label="Minimum rating"
              onChange={(event) => {
                const value = Number(event.target.value);
                onChange({ minRating: value === 0 ? undefined : value });
              }}
            />
            <span className={styles.rangeValue}>
              {params.minRating ? `${params.minRating}.0 and above` : 'Any rating'}
            </span>
          </div>
          <div className={styles.panelActions}>
            <button
              type="button"
              className={styles.reset}
              onClick={onReset}
              disabled={!hasActiveFilters(params) && !params.q}
            >
              Clear all
            </button>
          </div>
        </div>
      )}
      {resultSummary && (
        <p className={styles.summary}>
          <span>{resultSummary}</span>
        </p>
      )}
    </div>
  );
}
