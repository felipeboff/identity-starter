import type { Cache } from "../application/ports/cache";
import type { Clock } from "../application/ports/clock";

type StoredEntry = { raw: string; expiresAt: number };

export class InMemoryCache implements Cache {
  private readonly entries = new Map<string, StoredEntry>();

  constructor(private readonly clock: Clock) {}

  get<T>(key: string): Promise<T | undefined> {
    const stored = this.liveEntry(key);
    return Promise.resolve(stored ? (JSON.parse(stored.raw) as T) : undefined);
  }

  set(key: string, value: unknown, ttlMs: number): Promise<void> {
    this.entries.set(key, {
      raw: JSON.stringify(value),
      expiresAt: this.now() + ttlMs,
    });
    return Promise.resolve();
  }

  setIfNewer(
    key: string,
    value: unknown,
    version: number,
    ttlMs: number,
  ): Promise<void> {
    const versionKey = `${key}:version`;
    const stored = this.liveEntry(versionKey);
    if (stored && Number(stored.raw) >= version) return Promise.resolve();
    const expiresAt = this.now() + ttlMs;
    this.entries.set(key, { raw: JSON.stringify(value), expiresAt });
    this.entries.set(versionKey, { raw: String(version), expiresAt });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.entries.delete(key);
    return Promise.resolve();
  }

  increment(key: string, ttlMs: number): Promise<number> {
    const stored = this.liveEntry(key);
    const value = Number(stored?.raw ?? 0) + 1;
    this.entries.set(key, {
      raw: String(value),
      expiresAt: stored?.expiresAt ?? this.now() + ttlMs,
    });
    return Promise.resolve(value);
  }

  ttl(key: string): Promise<number | undefined> {
    const stored = this.liveEntry(key);
    return Promise.resolve(stored && stored.expiresAt - this.now());
  }

  private liveEntry(key: string): StoredEntry | undefined {
    const stored = this.entries.get(key);
    return stored && stored.expiresAt > this.now() ? stored : undefined;
  }

  private now(): number {
    return this.clock.now().getTime();
  }
}
