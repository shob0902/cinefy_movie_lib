// Auto-rotating 3D genre picker with drag, wheel and keyboard control.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GenreWithArtwork } from '../api/types';
import { genreBackground } from '../lib/genreArt';
import styles from './GenreCarousel.module.css';
interface Metrics {
  width: number;
  cardWidth: number;
  cardHeight: number;
  gap: number;
  spacing: number;
  curve: number;
  perspective: number;
  halfSpan: number;
}
interface Arc {
  xAt: (p: number) => number;
  zAt: (p: number) => number;
  tiltAt: (p: number) => number;
  depthAt: (p: number) => number;
  pAtX: (targetX: number) => number;
}
function buildArc(m: Metrics): Arc {
  const { cardWidth, gap, curve, perspective, halfSpan, spacing } = m;
  const zAt = (p: number) => -curve * p * p;
  const depthAt = (p: number) => perspective / (perspective - zAt(p));
  const tiltRad = (p: number) => Math.atan2(2 * curve * p, spacing);
  const projectedWidth = (p: number) => cardWidth * Math.cos(tiltRad(p)) * depthAt(p);
  const step = 0.05;
  const max = halfSpan + 3;
  const samples: number[] = [0];
  let accumulated = 0;
  for (let p = step; p <= max + step; p += step) {
    accumulated += ((projectedWidth(p - step) + projectedWidth(p)) / 2 + gap) * step;
    samples.push(accumulated);
  }
  const xAt = (p: number) => {
    const sign = p < 0 ? -1 : 1;
    const index = Math.min(Math.abs(p), max) / step;
    const low = Math.floor(index);
    const high = Math.min(low + 1, samples.length - 1);
    const fraction = index - low;
    const value = (samples[low] ?? 0) * (1 - fraction) + (samples[high] ?? 0) * fraction;
    return sign * value;
  };
  const pAtX = (targetX: number) => {
    const goal = Math.abs(targetX);
    for (let i = 1; i < samples.length; i += 1) {
      if ((samples[i] ?? 0) >= goal) return i * step;
    }
    return max;
  };
  return { xAt, zAt, depthAt, pAtX, tiltAt: (p) => (tiltRad(p) * 180) / Math.PI };
}
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
const AUTO_CARDS_PER_SECOND = 0.9;
function targetVisible(width: number): number {
  if (width < 480) return 3.4;
  if (width < 700) return 4.6;
  if (width < 980) return 6.2;
  if (width < 1300) return 7.4;
  return 8.6;
}
function metricsFor(width: number): Metrics {
  const visible = targetVisible(width);
  const gap = width < 700 ? 10 : 16;
  const cardWidth = Math.round(clamp(width / visible - gap, 112, 170));
  const spacing = cardWidth + gap;
  const cardHeight = Math.round(clamp(cardWidth * 1.45, 180, 240));
  const perspective = Math.round(clamp(width * 1.15, 950, 1800));
  const halfSpan = visible / 2 + 1.5;
  const curve = (perspective * 0.22) / (halfSpan * halfSpan);
  return { width, cardWidth, cardHeight, gap, spacing, curve, perspective, halfSpan };
}
interface GenreCarouselProps {
  genres: GenreWithArtwork[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
  isLoading: boolean;
}
export function GenreCarousel({
  genres,
  selectedIds,
  onToggle,
  onClear,
  isLoading,
}: GenreCarouselProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [metrics, setMetrics] = useState<Metrics>(() =>
    metricsFor(typeof window === 'undefined' ? 1200 : Math.min(window.innerWidth, 1440)),
  );
  const [measured, setMeasured] = useState(false);
  const offsetRef = useRef(0);
  const targetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const dragDistanceRef = useRef(0);
  const capturedRef = useRef(false);
  const samplesRef = useRef<Array<{ x: number; t: number }>>([]);
  const wheelSettleRef = useRef<number | null>(null);
  const count = genres.length;
  const arc = useMemo(() => buildArc(metrics), [metrics]);
  const canLoop = count >= 2 * (metrics.halfSpan + 2.5) + 1;
  const hoverRef = useRef(false);
  const focusWithinRef = useRef(false);
  const visibleRef = useRef(true);
  const autoEnabledRef = useRef(false);
  const canLoopRef = useRef(canLoop);
  const countRef = useRef(count);
  const lastFrameRef = useRef<number | null>(null);
  const { minOffset, maxOffset } = useMemo(() => {
    const edge = arc.pAtX(metrics.width / 2 - metrics.cardWidth / 2);
    const centre = Math.max(0, count - 1) / 2;
    if (count - 1 - 2 * edge <= 0) return { minOffset: centre, maxOffset: centre };
    return { minOffset: edge, maxOffset: count - 1 - edge };
  }, [arc, metrics.width, metrics.cardWidth, count]);
  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const paint = useCallback(
    (offset: number) => {
      const { width, cardWidth, halfSpan } = metrics;
      const cullX = width / 2 + cardWidth;
      for (let index = 0; index < cardRefs.current.length; index += 1) {
        const el = cardRefs.current[index];
        if (!el) continue;
        let p = index - offset;
        if (canLoop) {
          p = ((p % count) + count) % count;
          if (p > count / 2) p -= count;
        }
        const distance = Math.abs(p);
        const projectedX = arc.xAt(p);
        if (Math.abs(projectedX) > cullX || distance > halfSpan + 2.5) {
          el.style.visibility = 'hidden';
          el.style.opacity = '0';
          continue;
        }
        const z = arc.zAt(p);
        const depth = arc.depthAt(p);
        const x = projectedX / depth;
        const tilt = arc.tiltAt(p);
        const boost = Math.max(0, 1 - distance) * 0.07;
        const fade = 1 - clamp(distance / (halfSpan + 0.6), 0, 1) * 0.45;
        el.style.visibility = 'visible';
        el.style.opacity = fade.toFixed(3);
        el.style.transform =
          `translate3d(${x.toFixed(2)}px, 0, ${z.toFixed(2)}px) ` +
          `rotateY(${tilt.toFixed(2)}deg) scale(${(1 + boost).toFixed(3)})`;
        el.style.zIndex = String(1000 - Math.round(distance * 10));
      }
    },
    [metrics, arc, canLoop, count],
  );
  const paintRef = useRef(paint);
  useLayoutEffect(() => {
    paintRef.current = paint;
    canLoopRef.current = canLoop;
    countRef.current = count;
    autoEnabledRef.current = canLoop && !reducedMotion;
  }, [paint, canLoop, count, reducedMotion]);
  const startLoop = useCallback(() => {
    if (rafRef.current !== null) return;
    const tick = (now: number) => {
      const previous = lastFrameRef.current;
      lastFrameRef.current = now;
      const dt = previous === null ? 0 : Math.min(now - previous, 50);
      if (draggingRef.current) {
        paintRef.current(offsetRef.current);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const drifting =
        autoEnabledRef.current &&
        visibleRef.current &&
        !hoverRef.current &&
        !focusWithinRef.current;
      if (drifting) {
        offsetRef.current += (AUTO_CARDS_PER_SECOND / 1000) * dt;
        targetRef.current += (AUTO_CARDS_PER_SECOND / 1000) * dt;
      }
      const diff = targetRef.current - offsetRef.current;
      const settled = Math.abs(diff) < 0.0008;
      offsetRef.current = settled ? targetRef.current : offsetRef.current + diff * 0.14;
      const n = countRef.current;
      if (canLoopRef.current && n > 0 && Math.abs(offsetRef.current) > n) {
        const shift = Math.floor(offsetRef.current / n) * n;
        offsetRef.current -= shift;
        targetRef.current -= shift;
      }
      paintRef.current(offsetRef.current);
      if (settled && !drifting) {
        rafRef.current = null;
        lastFrameRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);
  const goTo = useCallback(
    (next: number, immediate = false) => {
      targetRef.current = canLoop ? next : clamp(next, minOffset, maxOffset);
      if (immediate || reducedMotion) {
        offsetRef.current = targetRef.current;
        paint(offsetRef.current);
        return;
      }
      startLoop();
    },
    [minOffset, maxOffset, paint, reducedMotion, startLoop, canLoop],
  );
  const seededRef = useRef(false);
  useLayoutEffect(() => {
    if (!seededRef.current && count > 0 && measured) {
      seededRef.current = true;
      const seed = canLoop ? 0 : minOffset;
      offsetRef.current = seed;
      targetRef.current = seed;
    } else if (!canLoop) {
      offsetRef.current = clamp(offsetRef.current, minOffset, maxOffset);
      targetRef.current = clamp(targetRef.current, minOffset, maxOffset);
    }
    paint(offsetRef.current);
  }, [minOffset, maxOffset, count, paint, measured, canLoop]);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => {
      const width = stage.clientWidth || window.innerWidth;
      setMeasured(true);
      setMetrics((current) => {
        const next = metricsFor(width);
        return next.width === current.width &&
          next.cardWidth === current.cardWidth &&
          next.spacing === current.spacing
          ? current
          : next;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [isLoading, count]);
  useLayoutEffect(() => {
    paint(offsetRef.current);
  }, [paint, count]);
  useEffect(() => {
    if (canLoop && !reducedMotion) startLoop();
  }, [canLoop, reducedMotion, startLoop]);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry?.isIntersecting ?? true;
        if (visibleRef.current) startLoop();
      },
      { threshold: 0 },
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, [isLoading, count, startLoop]);
  const didCentreRef = useRef(false);
  useEffect(() => {
    if (didCentreRef.current || count === 0) return;
    didCentreRef.current = true;
    const first = selectedIds[0];
    if (first === undefined) return;
    const index = genres.findIndex((genre) => genre.id === first);
    if (index >= 0) goTo(index, true);
  }, [count, genres, selectedIds, goTo]);
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    draggingRef.current = true;
    capturedRef.current = false;
    dragStartXRef.current = event.clientX;
    dragStartOffsetRef.current = offsetRef.current;
    dragDistanceRef.current = 0;
    samplesRef.current = [{ x: event.clientX, t: performance.now() }];
    startLoop();
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const dx = event.clientX - dragStartXRef.current;
    dragDistanceRef.current = Math.max(dragDistanceRef.current, Math.abs(dx));
    if (!capturedRef.current && Math.abs(dx) > 4) {
      event.currentTarget.setPointerCapture(event.pointerId);
      capturedRef.current = true;
    }
    const dragged = dragStartOffsetRef.current - dx / metrics.spacing;
    offsetRef.current = canLoop ? dragged : clamp(dragged, minOffset, maxOffset);
    targetRef.current = offsetRef.current;
    const samples = samplesRef.current;
    samples.push({ x: event.clientX, t: performance.now() });
    if (samples.length > 6) samples.shift();
  };
  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (event.pointerType !== 'mouse') hoverRef.current = false;
    if (capturedRef.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    capturedRef.current = false;
    const samples = samplesRef.current;
    const first = samples[0];
    const last = samples[samples.length - 1];
    let velocity = 0;
    if (first && last && last.t > first.t) {
      velocity = -((last.x - first.x) / metrics.spacing) / (last.t - first.t);
    }
    const projected = offsetRef.current + velocity * 160;
    goTo(Math.round(canLoop ? projected : clamp(projected, minOffset, maxOffset)));
  };
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      const scrolled = targetRef.current + event.deltaX / metrics.spacing;
      targetRef.current = canLoop ? scrolled : clamp(scrolled, minOffset, maxOffset);
      offsetRef.current = targetRef.current;
      paint(offsetRef.current);
      if (wheelSettleRef.current) window.clearTimeout(wheelSettleRef.current);
      wheelSettleRef.current = window.setTimeout(() => {
        goTo(Math.round(targetRef.current));
      }, 140);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [metrics.spacing, minOffset, maxOffset, paint, goTo, canLoop]);
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (wheelSettleRef.current) window.clearTimeout(wheelSettleRef.current);
    },
    [],
  );
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const jump: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      PageUp: -3,
      PageDown: 3,
    };
    const cardAt = (offset: number) => ((Math.round(offset) % count) + count) % count;
    if (event.key in jump) {
      event.preventDefault();
      const step = jump[event.key] ?? 0;
      const raw = Math.round(targetRef.current) + step;
      const next = canLoop ? raw : clamp(raw, minOffset, maxOffset);
      goTo(next);
      cardRefs.current[cardAt(next)]?.focus();
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const first = canLoop ? 0 : minOffset;
      const last = canLoop ? count - 1 : maxOffset;
      const next = event.key === 'Home' ? first : last;
      goTo(next);
      cardRefs.current[cardAt(next)]?.focus();
    }
  };
  if (isLoading) {
    return (
      <section className={styles.section}>
        <div className={styles.header}>
          <h2 className={styles.title}>Browse by genre</h2>
        </div>
        <div className={styles.skeletonRow} aria-hidden="true">
          {Array.from({ length: 7 }, (_, index) => (
            <span
              key={index}
              className={`skeleton ${styles.skeletonCard}`}
              style={{ width: metrics.cardWidth, height: metrics.cardHeight }}
            />
          ))}
        </div>
      </section>
    );
  }
  if (count === 0) return null;
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <h2 className={styles.title}>Browse by genre</h2>
        {selectedIds.length > 0 ? (
          <button type="button" className={styles.clear} onClick={onClear}>
            Clear {selectedIds.length} selected
          </button>
        ) : (
          <span className={styles.hint}>Drag, swipe or use arrow keys</span>
        )}
      </div>
      <div
        ref={stageRef}
        className={styles.stage}
        style={{
          perspective: `${metrics.perspective}px`,
          height: `${metrics.cardHeight + 60}px`,
        }}
        role="group"
        aria-label="Filter by genre"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onPointerEnter={() => {
          hoverRef.current = true;
        }}
        onPointerLeave={() => {
          hoverRef.current = false;
          startLoop();
        }}
        onFocus={(event) => {
          focusWithinRef.current =
            event.target instanceof Element && event.target.matches(':focus-visible');
        }}
        onBlur={() => {
          focusWithinRef.current = false;
          startLoop();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className={styles.track} style={{ height: `${metrics.cardHeight}px` }}>
          {genres.map((genre, index) => {
            const selected = selectedIds.includes(genre.id);
            return (
              <button
                key={genre.id}
                type="button"
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                className={[styles.card, selected ? styles.selected : '']
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  width: `${metrics.cardWidth}px`,
                  height: `${metrics.cardHeight}px`,
                  marginLeft: `${-metrics.cardWidth / 2}px`,
                  backgroundImage: genreBackground(genre),
                }}
                aria-pressed={selected}
                aria-label={`${genre.name}${selected ? ', selected' : ''}`}
                onFocus={(event) => {
                  if (event.currentTarget.matches(':focus-visible')) goTo(index);
                }}
                onClick={() => {
                  if (dragDistanceRef.current > 6) return;
                  onToggle(genre.id);
                }}
              >
                {genre.artwork && (
                  <img
                    className={styles.art}
                    src={genre.artwork.medium}
                    srcSet={genre.artwork.srcSet}
                    sizes={`${metrics.cardWidth}px`}
                    alt=""
                    decoding="async"
                    draggable={false}
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <span className={styles.grain} aria-hidden="true" />
                <span className={styles.scrim} aria-hidden="true" />
                {selected && (
                  <span className={styles.check} aria-hidden="true">
                    <svg className={styles.checkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
                      <path d="m5 13 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
                <span className={styles.label}>
                  <span className={styles.name}>{genre.name}</span>
                </span>
              </button>
            );
          })}
        </div>
        <span className={`${styles.fade} ${styles.fadeLeft}`} aria-hidden="true" />
        <span className={`${styles.fade} ${styles.fadeRight}`} aria-hidden="true" />
      </div>
    </section>
  );
}
