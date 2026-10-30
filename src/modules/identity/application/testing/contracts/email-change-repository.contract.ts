import { faker } from "@faker-js/faker";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import { beforeEach, expect, it } from "vitest";

import { EmailChangeRepository } from "../../ports/email-change.repository";

import type { RepositoryUnderContract } from "./repository-under-contract";
import { transactionalSaveContract } from "./transactional-save.contract";

import { EmailChange } from "@/identity/domain/email-change.entity";

const tokenHash = () => faker.string.hexadecimal({ length: 64, prefix: "" });

const registerEmailChange = (
  accountId = faker.database.mongodbObjectId(),
  at = faker.date.past(),
) =>
  EmailChange.register(
    {
      id: faker.database.mongodbObjectId(),
      accountId,
      newEmail: faker.internet.email().toLowerCase(),
      tokenHash: tokenHash(),
      expiresAt: faker.date.future(),
    },
    at,
  );

export const emailChangeRepositoryContract = (
  createRepository: () => RepositoryUnderContract<EmailChangeRepository>,
) => {
  let emailChanges: EmailChangeRepository;
  let transactions: TransactionRunner;

  beforeEach(() => {
    ({ repository: emailChanges, transactions } = createRepository());
  });

  const load = async (entity: EmailChange) =>
    (await emailChanges.findByTokenHash(
      entity.toSnapshot().tokenHash,
    )) as EmailChange;

  transactionalSaveContract(() => ({
    transactions,
    register: () => registerEmailChange(),
    save: (entity) => emailChanges.save(entity),
    load,
  }));

  it("keeps every field", async () => {
    const entity = registerEmailChange();

    await emailChanges.save(entity);

    expect(entity.version).toBe(1);
    expect((await load(entity)).toSnapshot()).toStrictEqual(
      entity.toSnapshot(),
    );
  });

  it("keeps the consumption saved on the same instance", async () => {
    const entity = registerEmailChange();
    await emailChanges.save(entity);
    entity.consume(faker.date.recent());

    await emailChanges.save(entity);

    expect((await load(entity)).toSnapshot()).toStrictEqual({
      ...entity.toSnapshot(),
      version: 2,
    });
  });

  it("returns null for an unknown token hash", async () => {
    expect(await emailChanges.findByTokenHash(tokenHash())).toBeNull();
  });

  it("lists the ones of one account in creation order", async () => {
    const accountId = faker.database.mongodbObjectId();
    const createdAt = faker.date.past();
    const first = registerEmailChange(accountId, createdAt);
    const second = registerEmailChange(
      accountId,
      new Date(createdAt.getTime() + 1_000),
    );
    await emailChanges.save(second);
    await emailChanges.save(registerEmailChange());
    await emailChanges.save(first);

    const listed = await emailChanges.listByAccountId(accountId);

    expect(listed.map((entity) => entity.toSnapshot().id)).toStrictEqual([
      first.toSnapshot().id,
      second.toSnapshot().id,
    ]);
  });

  it("lists nothing for an account with none", async () => {
    expect(
      await emailChanges.listByAccountId(faker.database.mongodbObjectId()),
    ).toStrictEqual([]);
  });
};
