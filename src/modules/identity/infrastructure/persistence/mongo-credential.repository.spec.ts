import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { beforeAll, describe } from "vitest";

import { IdentityModels } from "./identity-models";
import { MongoCredentialRepository } from "./mongo-credential.repository";

import { credentialRepositoryContract } from "@/identity/application/testing/contracts/credential-repository.contract";

describe("MongoCredentialRepository", () => {
  const mongo = useMemoryMongo();
  let models: IdentityModels;

  beforeAll(async () => {
    models = new IdentityModels(mongo.connection());
    await models.ready();
  });

  credentialRepositoryContract(() => new MongoCredentialRepository(models));
});
