export type InMemoryRepositoryShape = Readonly<{
  entity: unknown;
  snapshot: { id: string };
}>;

/**
 * Base for in-memory test repositories. Stores snapshots, not entities, so a
 * change only shows up in the next read after it is saved.
 */
export abstract class InMemoryRepository<S extends InMemoryRepositoryShape> {
  protected readonly snapshots = new Map<string, S["snapshot"]>();

  protected abstract toSnapshot(entity: S["entity"]): S["snapshot"];
  protected abstract restore(snapshot: S["snapshot"]): S["entity"];
}
