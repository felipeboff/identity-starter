import { MongoTransactionRunner } from "@shared/infrastructure/mongo/mongo-transaction-runner";
import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { beforeAll, describe } from "vitest";

import { IdentityModels } from "./identity-models";
import { MongoCredentialRepository } from "./mongo-credential.repository";

import { credentialRepositoryContract } from "@/identity/application/testing/contracts/credential-repository.contract";

describe("MongoCredentialRepository", () => {
  const mongo = useMemoryMongo();
  let models: IdentityModels;
  let transactions: MongoTransactionRunner;

  beforeAll(async () => {
    models = new IdentityModels(mongo.connection());
    await models.ready();
    transactions = new MongoTransactionRunner(mongo.connection());
  });

  credentialRepositoryContract(() => ({
    repository: new MongoCredentialRepository(models, transactions),
    transactions,
  }));
});
