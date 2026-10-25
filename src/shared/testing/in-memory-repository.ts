import { AppError } from "../domain/errors/app-error";
import { SharedError } from "../domain/errors/shared.error";

export type InMemoryRepositoryShape = Readonly<{
  entity: { markAsSaved(): void };
  snapshot: { id: string; version: number; createdAt: Date };
}>;

/** Stores snapshots, not entities, so a change only shows up after it is saved. */
export abstract class InMemoryRepository<S extends InMemoryRepositoryShape> {
  protected readonly snapshots = new Map<string, S["snapshot"]>();

  protected abstract toSnapshot(entity: S["entity"]): S["snapshot"];
  protected abstract restore(snapshot: S["snapshot"]): S["entity"];

  protected store(entity: S["entity"]): Promise<void> {
    return new Promise((resolve) => {
      const snapshot = this.toSnapshot(entity);
      const stored = this.snapshots.get(snapshot.id);
      if (snapshot.version === 0 && stored) {
        throw new AppError(SharedError.AlreadyExists, { id: snapshot.id });
      }
      if (snapshot.version > 0 && stored?.version !== snapshot.version) {
        throw new AppError(SharedError.VersionConflict, {
          id: snapshot.id,
          version: snapshot.version,
        });
      }
      this.snapshots.set(snapshot.id, {
        ...snapshot,
        version: snapshot.version + 1,
      });
      entity.markAsSaved();
      resolve();
    });
  }

  protected inCreationOrder(snapshots: S["snapshot"][]): S["entity"][] {
    return [...snapshots]
      .sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      )
      .map((snapshot) => this.restore(snapshot));
  }
}
