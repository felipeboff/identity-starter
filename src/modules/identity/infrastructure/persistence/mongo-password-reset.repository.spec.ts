import { MongoTransactionRunner } from "@shared/infrastructure/mongo/mongo-transaction-runner";
import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { beforeAll, describe } from "vitest";

import { IdentityModels } from "./identity-models";
import { MongoPasswordResetRepository } from "./mongo-password-reset.repository";

import { passwordResetRepositoryContract } from "@/identity/application/testing/contracts/password-reset-repository.contract";

describe("MongoPasswordResetRepository", () => {
  const mongo = useMemoryMongo();
  let models: IdentityModels;
  let transactions: MongoTransactionRunner;

  beforeAll(async () => {
    models = new IdentityModels(mongo.connection());
    await models.ready();
    transactions = new MongoTransactionRunner(mongo.connection());
  });

  passwordResetRepositoryContract(() => ({
    repository: new MongoPasswordResetRepository(models, transactions),
    transactions,
  }));
});
