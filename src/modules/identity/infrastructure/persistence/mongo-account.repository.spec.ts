import { MongoTransactionRunner } from "@shared/infrastructure/mongo/mongo-transaction-runner";
import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { beforeAll, describe } from "vitest";

import { IdentityModels } from "./identity-models";
import { MongoAccountRepository } from "./mongo-account.repository";

import { accountRepositoryContract } from "@/identity/application/testing/contracts/account-repository.contract";

describe("MongoAccountRepository", () => {
  const mongo = useMemoryMongo();
  let models: IdentityModels;
  let transactions: MongoTransactionRunner;

  beforeAll(async () => {
    models = new IdentityModels(mongo.connection());
    await models.ready();
    transactions = new MongoTransactionRunner(mongo.connection());
  });

  accountRepositoryContract(() => ({
    repository: new MongoAccountRepository(models, transactions),
    transactions,
  }));
});
