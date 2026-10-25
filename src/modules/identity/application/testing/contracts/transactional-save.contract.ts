import { faker } from "@faker-js/faker";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import { expect, it } from "vitest";

type Saveable = { version: number; toSnapshot(): unknown };

export type TransactionalSave<E extends Saveable> = Readonly<{
  transactions: TransactionRunner;
  register: () => E;
  save: (entity: E) => Promise<void>;
  load: (entity: E) => Promise<E | null>;
}>;

export const transactionalSaveContract = <E extends Saveable>(
  subject: () => TransactionalSave<E>,
) => {
  it("moves the version only when the transaction commits", async () => {
    const { transactions, register, save, load } = subject();
    const entity = register();
    let versionInside: number | undefined;

    await transactions.run(async () => {
      await save(entity);
      versionInside = entity.version;
    });

    expect(versionInside).toBe(0);
    expect(entity.version).toBe(1);
    expect((await load(entity))?.toSnapshot()).toStrictEqual(
      entity.toSnapshot(),
    );
  });

  it("stores nothing from a transaction that fails", async () => {
    const { transactions, register, save, load } = subject();
    const entity = register();
    const failure = new Error(faker.lorem.sentence());

    await expect(
      transactions.run(async () => {
        await save(entity);
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(await load(entity)).toBeNull();
    expect(entity.version).toBe(0);
  });
};
