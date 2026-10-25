export type RateLimitRule = Readonly<{
  name: string;
  limit: number;
  windowMs: number;
}>;

export type RateLimitCount = Readonly<{
  count: number;
  resetInMs: number;
}>;

export type RateLimiter = {
  increment(rule: RateLimitRule, key: string): Promise<RateLimitCount>;
  read(rule: RateLimitRule, key: string): Promise<RateLimitCount>;
  clear(rule: RateLimitRule, key: string): Promise<void>;
};
