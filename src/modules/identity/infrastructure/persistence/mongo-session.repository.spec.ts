import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { beforeAll, describe } from "vitest";

import { IdentityModels } from "./identity-models";
import { MongoSessionRepository } from "./mongo-session.repository";

import { sessionRepositoryContract } from "@/identity/application/testing/contracts/session-repository.contract";

describe("MongoSessionRepository", () => {
  const mongo = useMemoryMongo();
  let models: IdentityModels;

  beforeAll(async () => {
    models = new IdentityModels(mongo.connection());
    await models.ready();
  });

  sessionRepositoryContract(() => new MongoSessionRepository(models));
});
