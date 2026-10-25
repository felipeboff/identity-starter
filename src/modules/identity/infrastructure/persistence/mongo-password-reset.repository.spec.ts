import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { beforeAll, describe } from "vitest";

import { IdentityModels } from "./identity-models";
import { MongoPasswordResetRepository } from "./mongo-password-reset.repository";

import { passwordResetRepositoryContract } from "@/identity/application/testing/contracts/password-reset-repository.contract";

describe("MongoPasswordResetRepository", () => {
  const mongo = useMemoryMongo();
  let models: IdentityModels;

  beforeAll(async () => {
    models = new IdentityModels(mongo.connection());
    await models.ready();
  });

  passwordResetRepositoryContract(
    () => new MongoPasswordResetRepository(models),
  );
});
