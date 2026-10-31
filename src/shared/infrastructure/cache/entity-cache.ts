import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { FailOpenCache } from "./fail-open-cache";

export type CacheableEntity = Readonly<{
  id: Readonly<{ value: string }>;
  toSnapshot(): unknown;
}>;

export type EntityCacheDeps<Entity, Entry> = Readonly<{
  cache: FailOpenCache;
  transactions: TransactionRunner;
  ttlMs: number;
  namespace: string;
  restore: (entry: Entry) => Entity;
}>;

export type EntityLookup<Entity> = Readonly<{
  index: string;
  value: string;
  matches: (entity: Entity) => boolean;
  load: () => Promise<Entity | null>;
}>;

export class EntityCache<Entity extends CacheableEntity, Entry> {
  constructor(private readonly deps: EntityCacheDeps<Entity, Entry>) {}

  async findById(
    id: string,
    load: () => Promise<Entity | null>,
  ): Promise<Entity | null> {
    if (this.deps.transactions.isRunning()) return load();

    const entry = await this.deps.cache.get<Entry>(this.keyOf(id));
    if (entry !== undefined) return this.deps.restore(entry);

    const entity = await load();
    if (entity) await this.remember(entity);
    return entity;
  }

  async findBy(lookup: EntityLookup<Entity>): Promise<Entity | null> {
    if (this.deps.transactions.isRunning()) return lookup.load();

    const indexKey = this.indexKeyOf(lookup);
    const id = await this.deps.cache.get<string>(indexKey);
    const entry =
      id === undefined
        ? undefined
        : await this.deps.cache.get<Entry>(this.keyOf(id));
    const cached = entry === undefined ? undefined : this.deps.restore(entry);
    if (cached && lookup.matches(cached)) return cached;

    const entity = await lookup.load();
    if (entity) {
      await this.deps.cache.set(indexKey, entity.id.value, this.deps.ttlMs);
      await this.remember(entity);
    }
    return entity;
  }

  forget(entity: Entity): void {
    const key = this.keyOf(entity.id.value);
    this.deps.transactions.afterCommit(() => void this.deps.cache.delete(key));
  }

  private async remember(entity: Entity): Promise<void> {
    await this.deps.cache.set(
      this.keyOf(entity.id.value),
      entity.toSnapshot(),
      this.deps.ttlMs,
    );
  }

  private keyOf(id: string): string {
    return `${this.deps.namespace}:${id}`;
  }

  private indexKeyOf(lookup: EntityLookup<Entity>): string {
    return `${this.deps.namespace}:${lookup.index}:${lookup.value}`;
  }
}
