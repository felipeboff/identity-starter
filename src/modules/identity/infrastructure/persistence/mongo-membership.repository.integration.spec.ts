import { MongoTransactionRunner } from "@shared/infrastructure/mongo/mongo-transaction-runner";
import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { beforeAll, describe } from "vitest";

import { IdentityModels } from "./identity-models";
import { MongoMembershipRepository } from "./mongo-membership.repository";

import { membershipRepositoryContract } from "@/identity/application/testing/contracts/membership-repository.contract";

describe("MongoMembershipRepository", () => {
  const mongo = useMemoryMongo();
  let models: IdentityModels;
  let transactions: MongoTransactionRunner;

  beforeAll(async () => {
    models = new IdentityModels(mongo.connection());
    await models.ready();
    transactions = new MongoTransactionRunner(mongo.connection());
  });

  membershipRepositoryContract(() => ({
    repository: new MongoMembershipRepository(models, transactions),
    transactions,
  }));
});
