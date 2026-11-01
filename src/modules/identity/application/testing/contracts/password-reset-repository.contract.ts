import { faker } from "@faker-js/faker";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import { beforeEach, expect, it } from "vitest";

import { PasswordResetRepository } from "../../ports/password-reset.repository";

import type { RepositoryUnderContract } from "./repository-under-contract";
import { transactionalSaveContract } from "./transactional-save.contract";

import { PasswordReset } from "@/identity/domain/password-reset.entity";

const tokenHash = () => faker.string.hexadecimal({ length: 64, prefix: "" });

const registerPasswordReset = (
  accountId = faker.database.mongodbObjectId(),
  at = faker.date.past(),
) =>
  PasswordReset.register(
    {
      id: faker.database.mongodbObjectId(),
      accountId,
      tokenHash: tokenHash(),
      expiresAt: faker.date.future(),
    },
    at,
  );

export const passwordResetRepositoryContract = (
  createRepository: () => RepositoryUnderContract<PasswordResetRepository>,
) => {
  let passwordResets: PasswordResetRepository;
  let transactions: TransactionRunner;

  beforeEach(() => {
    ({ repository: passwordResets, transactions } = createRepository());
  });

  const load = async (entity: PasswordReset) =>
    (await passwordResets.findByTokenHash(
      entity.toSnapshot().tokenHash,
    )) as PasswordReset;

  transactionalSaveContract(() => ({
    transactions,
    register: () => registerPasswordReset(),
    save: (entity) => passwordResets.save(entity),
    load,
  }));

  it("keeps every field", async () => {
    const entity = registerPasswordReset();

    await passwordResets.save(entity);

    expect(entity.version).toBe(1);
    expect((await load(entity)).toSnapshot()).toStrictEqual(
      entity.toSnapshot(),
    );
  });

  it("keeps the consumption saved on the same instance", async () => {
    const entity = registerPasswordReset();
    await passwordResets.save(entity);
    entity.consume(faker.date.recent());

    await passwordResets.save(entity);

    expect((await load(entity)).toSnapshot()).toStrictEqual({
      ...entity.toSnapshot(),
      version: 2,
    });
  });

  it("returns null for an unknown token hash", async () => {
    expect(await passwordResets.findByTokenHash(tokenHash())).toBeNull();
  });

  it("lists the ones of one account in creation order", async () => {
    const accountId = faker.database.mongodbObjectId();
    const createdAt = faker.date.past();
    const first = registerPasswordReset(accountId, createdAt);
    const second = registerPasswordReset(
      accountId,
      new Date(createdAt.getTime() + 1_000),
    );
    await passwordResets.save(second);
    await passwordResets.save(registerPasswordReset());
    await passwordResets.save(first);

    const listed = await passwordResets.listByAccountId(accountId);

    expect(listed.map((entity) => entity.toSnapshot().id)).toStrictEqual([
      first.toSnapshot().id,
      second.toSnapshot().id,
    ]);
  });

  it("lists nothing for an account with none", async () => {
    expect(
      await passwordResets.listByAccountId(faker.database.mongodbObjectId()),
    ).toStrictEqual([]);
  });
};
