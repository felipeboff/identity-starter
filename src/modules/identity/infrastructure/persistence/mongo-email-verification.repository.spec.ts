import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { beforeAll, describe } from "vitest";

import { IdentityModels } from "./identity-models";
import { MongoEmailVerificationRepository } from "./mongo-email-verification.repository";

import { emailVerificationRepositoryContract } from "@/identity/application/testing/contracts/email-verification-repository.contract";

describe("MongoEmailVerificationRepository", () => {
  const mongo = useMemoryMongo();
  let models: IdentityModels;

  beforeAll(async () => {
    models = new IdentityModels(mongo.connection());
    await models.ready();
  });

  emailVerificationRepositoryContract(
    () => new MongoEmailVerificationRepository(models),
  );
});
