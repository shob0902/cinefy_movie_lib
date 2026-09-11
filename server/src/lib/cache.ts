// Layered memory and durable cache with stale-while-revalidate.
import { logger } from './logger.js';
import { SingleFlight } from './singleflight.js';
export interface CacheRecord<T = unknown> {
  value: T;
  fetchedAt: number;
  expiresAt: number;
}
export interface PersistentTier {
  get(key: string): CacheRecord | undefined;
  set(key: string, record: CacheRecord, graceMs: number): void;
  delete(key: string): void;
}
export type CacheState = 'fresh' | 'revalidating' | 'stale' | 'miss';
export interface CacheResult<T> {
  value: T;
  state: CacheState;
  fetchedAt: number;
}
export interface SwrOptions {
  ttlMs: number;
  graceMs: number;
  persist?: boolean;
}
export class LayeredCache {
  private readonly memory = new Map<string, CacheRecord>();
  private readonly flight = new SingleFlight<CacheRecord>();
  private persistent: PersistentTier | undefined;
  private hits = 0;
  private misses = 0;
  private staleServes = 0;
  constructor(private readonly maxEntries: number) {}
  attachPersistentTier(tier: PersistentTier) {
    this.persistent = tier;
  }
  get stats() {
    const total = this.hits + this.misses;
    return {
      entries: this.memory.size,
      hits: this.hits,
      misses: this.misses,
      staleServes: this.staleServes,
      hitRate: total === 0 ? 0 : Number((this.hits / total).toFixed(3)),
      inFlight: this.flight.size,
    };
  }
  private touch(key: string, record: CacheRecord) {
    this.memory.delete(key);
    this.memory.set(key, record);
    if (this.memory.size > this.maxEntries) {
      const oldest = this.memory.keys().next();
      if (!oldest.done) this.memory.delete(oldest.value);
    }
  }
  private read(key: string): CacheRecord | undefined {
    const inMemory = this.memory.get(key);
    if (inMemory) {
      this.touch(key, inMemory);
      return inMemory;
    }
    const durable = this.persistent?.get(key);
    if (durable) {
      this.touch(key, durable);
      return durable;
    }
    return undefined;
  }
  private write(key: string, record: CacheRecord, options: SwrOptions) {
    this.touch(key, record);
    if (options.persist !== false) {
      try {
        this.persistent?.set(key, record, options.graceMs);
      } catch (error) {
        logger.warn('cache.persist_failed', { key, error: String(error) });
      }
    }
  }
  invalidate(prefix: string) {
    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) this.memory.delete(key);
    }
  }
  async swr<T>(key: string, options: SwrOptions, loader: () => Promise<T>): Promise<CacheResult<T>> {
    const now = Date.now();
    const existing = this.read(key);
    const load = async (): Promise<CacheRecord<T>> => {
      const value = await loader();
      const record: CacheRecord<T> = {
        value,
        fetchedAt: Date.now(),
        expiresAt: Date.now() + options.ttlMs,
      };
      this.write(key, record, options);
      return record;
    };
    if (existing) {
      if (existing.expiresAt > now) {
        this.hits += 1;
        return {
          value: existing.value as T,
          state: 'fresh',
          fetchedAt: existing.fetchedAt,
        };
      }
      if (existing.expiresAt + options.graceMs > now) {
        this.hits += 1;
        this.staleServes += 1;
        if (!this.flight.has(key)) {
          void this.flight.run(key, load).catch((error) => {
            logger.warn('cache.revalidate_failed', { key, error: String(error) });
          });
        }
        return {
          value: existing.value as T,
          state: 'revalidating',
          fetchedAt: existing.fetchedAt,
        };
      }
    }
    this.misses += 1;
    try {
      const record = (await this.flight.run(key, load)) as CacheRecord<T>;
      return { value: record.value, state: 'miss', fetchedAt: record.fetchedAt };
    } catch (error) {
      if (existing) {
        this.staleServes += 1;
        logger.warn('cache.serving_expired_after_error', { key, error: String(error) });
        return {
          value: existing.value as T,
          state: 'stale',
          fetchedAt: existing.fetchedAt,
        };
      }
      throw error;
    }
  }
}
