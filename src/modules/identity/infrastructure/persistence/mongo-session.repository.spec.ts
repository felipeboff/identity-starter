import { MongoTransactionRunner } from "@shared/infrastructure/mongo/mongo-transaction-runner";
import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { beforeAll, describe } from "vitest";

import { IdentityModels } from "./identity-models";
import { MongoSessionRepository } from "./mongo-session.repository";

import { sessionRepositoryContract } from "@/identity/application/testing/contracts/session-repository.contract";

describe("MongoSessionRepository", () => {
  const mongo = useMemoryMongo();
  let models: IdentityModels;
  let transactions: MongoTransactionRunner;

  beforeAll(async () => {
    models = new IdentityModels(mongo.connection());
    await models.ready();
    transactions = new MongoTransactionRunner(mongo.connection());
  });

  sessionRepositoryContract(() => ({
    repository: new MongoSessionRepository(models, transactions),
    transactions,
  }));
});
