export const PAGE_DEFAULT_LIMIT = 50;
export const PAGE_MAX_LIMIT = 100;

export type PageRequest = Readonly<{
  cursor?: string;
  limit: number;
}>;

export type PageQuery = Readonly<{
  after: string | null;
  limit: number;
}>;

export type Page<T> = Readonly<{
  items: T[];
  nextCursor: string | null;
}>;
