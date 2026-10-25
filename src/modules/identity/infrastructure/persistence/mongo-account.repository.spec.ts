import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { beforeAll, describe } from "vitest";

import { IdentityModels } from "./identity-models";
import { MongoAccountRepository } from "./mongo-account.repository";

import { accountRepositoryContract } from "@/identity/application/testing/contracts/account-repository.contract";

describe("MongoAccountRepository", () => {
  const mongo = useMemoryMongo();
  let models: IdentityModels;

  beforeAll(async () => {
    models = new IdentityModels(mongo.connection());
    await models.ready();
  });

  accountRepositoryContract(() => new MongoAccountRepository(models));
});
