import { faker } from "@faker-js/faker";
import { FailOpenCache } from "@shared/infrastructure/cache/fail-open-cache";
import { MongoTransactionRunner } from "@shared/infrastructure/mongo/mongo-transaction-runner";
import { RedisCache } from "@shared/infrastructure/redis/redis-cache";
import { RedisConnection } from "@shared/infrastructure/redis/redis-connection";
import { FakeLogger } from "@shared/testing/fake-logger";
import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { useMemoryRedis } from "@shared/testing/memory-redis";
import type { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { CachedAccountRepository } from "./cached-account.repository";
import { IdentityModels } from "./identity-models";
import { MongoAccountRepository } from "./mongo-account.repository";

import { accountRepositoryContract } from "@/identity/application/testing/contracts/account-repository.contract";
import { Account } from "@/identity/domain/account.entity";

type CreateOptions = {
  client?: Redis;
};

type ChangeAccount = (account: Account) => void;

const registerAccount = () => {
  const id = faker.database.mongodbObjectId();
  return Account.register(
    {
      id,
      name: faker.person.fullName(),
      email: faker.internet.email(),
      createdBy: id,
    },
    faker.date.past(),
  );
};

describe("CachedAccountRepository", () => {
  const mongo = useMemoryMongo();
  const redis = useMemoryRedis();
  let models: IdentityModels;
  let transactions: MongoTransactionRunner;
  let connection: RedisConnection;

  beforeAll(async () => {
    models = new IdentityModels(mongo.connection());
    await models.ready();
    transactions = new MongoTransactionRunner(mongo.connection());
    connection = new RedisConnection({
      url: redis.url(),
      logger: new FakeLogger(),
    });
    await connection.connect();
  });

  afterAll(async () => {
    await connection.close();
  });

  const create = (options: CreateOptions = {}) => {
    const inner = new MongoAccountRepository(models, transactions);
    const repository = new CachedAccountRepository({
      inner,
      cache: new FailOpenCache({
        cache: new RedisCache({ client: options.client ?? connection.client }),
        logger: new FakeLogger(),
      }),
      transactions,
      ttlMs: faker.number.int({ min: 10_000, max: 60_000 }),
    });
    return { inner, repository };
  };

  accountRepositoryContract(() => ({
    repository: create().repository,
    transactions,
  }));

  it.each<[string, ChangeAccount]>([
    ["a new account", () => undefined],
    [
      "a verified, seen and deleted account",
      (account) => {
        const at = faker.date.recent();
        account.markEmailAsVerified(at);
        account.markAsLastSeen(at);
        account.markAsDeleted(at);
      },
    ],
  ])(
    "reads every field of %s by id from the cache after the first read",
    async (_, change) => {
      const { inner, repository } = create();
      const account = registerAccount();
      change(account);
      await repository.save(account);
      await repository.findById(account.id.value);
      const findById = vi.spyOn(inner, "findById");

      const cached = await repository.findById(account.id.value);

      expect(cached?.toSnapshot()).toStrictEqual(account.toSnapshot());
      expect(findById).not.toHaveBeenCalled();
    },
  );

  it("reads an account by email, in any case, from the cache after the first read", async () => {
    const { inner, repository } = create();
    const account = registerAccount();
    await repository.save(account);
    await repository.findByEmail(account.email.value.toUpperCase());
    const findByEmail = vi.spyOn(inner, "findByEmail");

    const cached = await repository.findByEmail(account.email.value);

    expect(cached?.toSnapshot()).toStrictEqual(account.toSnapshot());
    expect(findByEmail).not.toHaveBeenCalled();
  });

  it("reads a saved change on the next read", async () => {
    const { repository } = create();
    const account = registerAccount();
    await repository.save(account);
    await repository.findById(account.id.value);
    const name = faker.person.fullName();
    account.updateName(name, faker.date.recent());
    await repository.save(account);

    const loaded = await repository.findById(account.id.value);

    expect(loaded?.name).toBe(name);
  });

  it("stops finding an account by its old email once the email changes", async () => {
    const { repository } = create();
    const account = registerAccount();
    await repository.save(account);
    const oldEmail = account.email.value;
    await repository.findByEmail(oldEmail);
    account.changeEmail(
      `${faker.string.alpha(4)}${oldEmail}`,
      faker.date.recent(),
    );
    await repository.save(account);
    await repository.findById(account.id.value);

    const found = await repository.findByEmail(oldEmail);

    expect(found).toBeNull();
  });

  it("saves and reads through the store while Redis is unavailable", async () => {
    const down = new RedisConnection({
      url: redis.url(),
      logger: new FakeLogger(),
    });
    const { repository } = create({ client: down.client });
    const account = registerAccount();

    await repository.save(account);
    const loaded = await repository.findById(account.id.value);

    expect(loaded?.toSnapshot()).toStrictEqual(account.toSnapshot());
  });
});
