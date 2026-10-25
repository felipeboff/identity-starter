import { faker } from "@faker-js/faker";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import { beforeEach, expect, it } from "vitest";

import { EmailVerificationRepository } from "../../ports/email-verification.repository";

import type { RepositoryUnderContract } from "./repository-under-contract";
import { transactionalSaveContract } from "./transactional-save.contract";

import { EmailVerification } from "@/identity/domain/email-verification.entity";

const tokenHash = () => faker.string.hexadecimal({ length: 64, prefix: "" });

const registerEmailVerification = (
  accountId = faker.database.mongodbObjectId(),
  at = faker.date.past(),
) =>
  EmailVerification.register(
    {
      id: faker.database.mongodbObjectId(),
      accountId,
      tokenHash: tokenHash(),
      expiresAt: faker.date.future(),
    },
    at,
  );

export const emailVerificationRepositoryContract = (
  createRepository: () => RepositoryUnderContract<EmailVerificationRepository>,
) => {
  let emailVerifications: EmailVerificationRepository;
  let transactions: TransactionRunner;

  beforeEach(() => {
    ({ repository: emailVerifications, transactions } = createRepository());
  });

  const load = async (entity: EmailVerification) =>
    (await emailVerifications.findByTokenHash(
      entity.toSnapshot().tokenHash,
    )) as EmailVerification;

  transactionalSaveContract(() => ({
    transactions,
    register: () => registerEmailVerification(),
    save: (entity) => emailVerifications.save(entity),
    load,
  }));

  it("keeps every field", async () => {
    const entity = registerEmailVerification();

    await emailVerifications.save(entity);

    expect(entity.version).toBe(1);
    expect((await load(entity)).toSnapshot()).toStrictEqual(
      entity.toSnapshot(),
    );
  });

  it("keeps the consumption saved on the same instance", async () => {
    const entity = registerEmailVerification();
    await emailVerifications.save(entity);
    entity.consume(faker.date.recent());

    await emailVerifications.save(entity);

    expect((await load(entity)).toSnapshot()).toStrictEqual({
      ...entity.toSnapshot(),
      version: 2,
    });
  });

  it("returns null for an unknown token hash", async () => {
    expect(await emailVerifications.findByTokenHash(tokenHash())).toBeNull();
  });

  it("lists the ones of one account in creation order", async () => {
    const accountId = faker.database.mongodbObjectId();
    const createdAt = faker.date.past();
    const first = registerEmailVerification(accountId, createdAt);
    const second = registerEmailVerification(
      accountId,
      new Date(createdAt.getTime() + 1_000),
    );
    await emailVerifications.save(second);
    await emailVerifications.save(registerEmailVerification());
    await emailVerifications.save(first);

    const listed = await emailVerifications.listByAccountId(accountId);

    expect(listed.map((entity) => entity.toSnapshot().id)).toStrictEqual([
      first.toSnapshot().id,
      second.toSnapshot().id,
    ]);
  });

  it("lists nothing for an account with none", async () => {
    expect(
      await emailVerifications.listByAccountId(
        faker.database.mongodbObjectId(),
      ),
    ).toStrictEqual([]);
  });
};
