export type Cache = {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  increment(key: string, ttlMs: number): Promise<number>;
  ttl(key: string): Promise<number | undefined>;
};
