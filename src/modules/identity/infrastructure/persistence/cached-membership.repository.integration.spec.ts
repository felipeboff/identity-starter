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

import { CachedMembershipRepository } from "./cached-membership.repository";
import { IdentityModels } from "./identity-models";
import { MongoMembershipRepository } from "./mongo-membership.repository";

import { membershipRepositoryContract } from "@/identity/application/testing/contracts/membership-repository.contract";
import { IdentityPermission } from "@/identity/domain/identity.permission";
import {
  Membership,
  MembershipRole,
} from "@/identity/domain/membership.entity";

type CreateOptions = {
  client?: Redis;
};

type ChangeMembership = (membership: Membership) => void;

const registerMembership = () => {
  const accountId = faker.database.mongodbObjectId();
  return Membership.register(
    {
      id: faker.database.mongodbObjectId(),
      accountId,
      createdBy: accountId,
      role: faker.helpers.objectValue(MembershipRole),
      permissions: faker.helpers.arrayElements(
        Object.values(IdentityPermission),
      ),
    },
    faker.date.past(),
  );
};

describe("CachedMembershipRepository", () => {
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
    const inner = new MongoMembershipRepository(models, transactions);
    const repository = new CachedMembershipRepository({
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

  membershipRepositoryContract(() => ({
    repository: create().repository,
    transactions,
  }));

  it.each<[string, ChangeMembership]>([
    ["an active membership", () => undefined],
    [
      "a deleted membership",
      (membership) => membership.markAsDeleted(faker.date.recent()),
    ],
  ])(
    "reads every field of %s by account from the cache after the first read",
    async (_, change) => {
      const { inner, repository } = create();
      const membership = registerMembership();
      change(membership);
      await repository.save(membership);
      await repository.findByAccountId(membership.accountId.value);
      const findByAccountId = vi.spyOn(inner, "findByAccountId");

      const cached = await repository.findByAccountId(
        membership.accountId.value,
      );

      expect(cached?.toSnapshot()).toStrictEqual(membership.toSnapshot());
      expect(findByAccountId).not.toHaveBeenCalled();
    },
  );

  it("reads a membership by id from the cache after the first read", async () => {
    const { inner, repository } = create();
    const membership = registerMembership();
    await repository.save(membership);
    await repository.findById(membership.id.value);
    const findById = vi.spyOn(inner, "findById");

    const cached = await repository.findById(membership.id.value);

    expect(cached?.toSnapshot()).toStrictEqual(membership.toSnapshot());
    expect(findById).not.toHaveBeenCalled();
  });

  it("reads a saved change on the next read", async () => {
    const { repository } = create();
    const membership = registerMembership();
    await repository.save(membership);
    await repository.findByAccountId(membership.accountId.value);
    membership.updatePermissions([], faker.date.recent());
    await repository.save(membership);

    const loaded = await repository.findByAccountId(membership.accountId.value);

    expect(loaded?.permissions).toStrictEqual([]);
  });

  it("saves and reads through the store while Redis is unavailable", async () => {
    const down = new RedisConnection({
      url: redis.url(),
      logger: new FakeLogger(),
    });
    const { repository } = create({ client: down.client });
    const membership = registerMembership();

    await repository.save(membership);
    const loaded = await repository.findByAccountId(membership.accountId.value);

    expect(loaded?.toSnapshot()).toStrictEqual(membership.toSnapshot());
  });
});
