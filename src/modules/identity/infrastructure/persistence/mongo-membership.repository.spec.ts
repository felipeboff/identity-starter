import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { beforeAll, describe } from "vitest";

import { IdentityModels } from "./identity-models";
import { MongoMembershipRepository } from "./mongo-membership.repository";

import { membershipRepositoryContract } from "@/identity/application/testing/contracts/membership-repository.contract";

describe("MongoMembershipRepository", () => {
  const mongo = useMemoryMongo();
  let models: IdentityModels;

  beforeAll(async () => {
    models = new IdentityModels(mongo.connection());
    await models.ready();
  });

  membershipRepositoryContract(() => new MongoMembershipRepository(models));
});
