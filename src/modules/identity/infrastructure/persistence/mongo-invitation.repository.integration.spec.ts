import { MongoTransactionRunner } from "@shared/infrastructure/mongo/mongo-transaction-runner";
import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { beforeAll, describe } from "vitest";

import { IdentityModels } from "./identity-models";
import { MongoInvitationRepository } from "./mongo-invitation.repository";

import { invitationRepositoryContract } from "@/identity/application/testing/contracts/invitation-repository.contract";

describe("MongoInvitationRepository", () => {
  const mongo = useMemoryMongo();
  let models: IdentityModels;
  let transactions: MongoTransactionRunner;

  beforeAll(async () => {
    models = new IdentityModels(mongo.connection());
    await models.ready();
    transactions = new MongoTransactionRunner(mongo.connection());
  });

  invitationRepositoryContract(() => ({
    repository: new MongoInvitationRepository(models, transactions),
    transactions,
  }));
});
