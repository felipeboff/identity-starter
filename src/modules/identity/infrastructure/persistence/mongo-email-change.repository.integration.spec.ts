import { MongoTransactionRunner } from "@shared/infrastructure/mongo/mongo-transaction-runner";
import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { beforeAll, describe } from "vitest";

import { IdentityModels } from "./identity-models";
import { MongoEmailChangeRepository } from "./mongo-email-change.repository";

import { emailChangeRepositoryContract } from "@/identity/application/testing/contracts/email-change-repository.contract";

describe("MongoEmailChangeRepository", () => {
  const mongo = useMemoryMongo();
  let models: IdentityModels;
  let transactions: MongoTransactionRunner;

  beforeAll(async () => {
    models = new IdentityModels(mongo.connection());
    await models.ready();
    transactions = new MongoTransactionRunner(mongo.connection());
  });

  emailChangeRepositoryContract(() => ({
    repository: new MongoEmailChangeRepository(models, transactions),
    transactions,
  }));
});
