// Fails fast while the upstream is clearly down.
import { logger } from './logger.js';
export type BreakerState = 'closed' | 'open' | 'half-open';
export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private probeInFlight = false;
  constructor(
    private readonly name: string,
    private readonly failureThreshold = 5,
    private readonly openMs = 20_000,
  ) {}
  get state(): BreakerState {
    if (this.failures < this.failureThreshold) return 'closed';
    if (Date.now() - this.openedAt >= this.openMs) return 'half-open';
    return 'open';
  }
  get snapshot() {
    return {
      state: this.state,
      consecutiveFailures: this.failures,
      retryInMs: this.state === 'open' ? Math.max(0, this.openMs - (Date.now() - this.openedAt)) : 0,
    };
  }
  canAttempt(): boolean {
    const state = this.state;
    if (state === 'closed') return true;
    if (state === 'open') return false;
    if (this.probeInFlight) return false;
    this.probeInFlight = true;
    return true;
  }
  recordSuccess() {
    if (this.failures > 0) logger.info('breaker.closed', { name: this.name });
    this.failures = 0;
    this.probeInFlight = false;
  }
  recordFailure() {
    this.failures += 1;
    this.probeInFlight = false;
    if (this.failures === this.failureThreshold) {
      this.openedAt = Date.now();
      logger.warn('breaker.opened', { name: this.name, failures: this.failures });
    } else if (this.failures > this.failureThreshold) {
      this.openedAt = Date.now();
    }
  }
}
