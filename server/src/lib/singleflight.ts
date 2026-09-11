// Collapses concurrent calls for one key into a single execution.
export class SingleFlight<T> {
  private readonly inFlight = new Map<string, Promise<T>>();
  get size(): number {
    return this.inFlight.size;
  }
  has(key: string): boolean {
    return this.inFlight.has(key);
  }
  async run(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) return existing;
    const promise = (async () => fn())().finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }
}
