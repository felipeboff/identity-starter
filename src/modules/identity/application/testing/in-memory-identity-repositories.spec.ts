import { InMemoryTransactionRunner } from "@shared/testing/in-memory-transaction-runner";
import { describe } from "vitest";

import { accountRepositoryContract } from "./contracts/account-repository.contract";
import { credentialRepositoryContract } from "./contracts/credential-repository.contract";
import { emailVerificationRepositoryContract } from "./contracts/email-verification-repository.contract";
import { membershipRepositoryContract } from "./contracts/membership-repository.contract";
import { passwordResetRepositoryContract } from "./contracts/password-reset-repository.contract";
import { sessionRepositoryContract } from "./contracts/session-repository.contract";
import {
  InMemoryAccountRepository,
  InMemoryCredentialRepository,
  InMemoryEmailVerificationRepository,
  InMemoryMembershipRepository,
  InMemoryPasswordResetRepository,
  InMemorySessionRepository,
} from "./in-memory-identity-repositories";

const inMemory = <R>(
  Repository: new (transactions: InMemoryTransactionRunner) => R,
) => {
  const transactions = new InMemoryTransactionRunner();
  return { repository: new Repository(transactions), transactions };
};

describe("InMemoryAccountRepository", () => {
  accountRepositoryContract(() => inMemory(InMemoryAccountRepository));
});

describe("InMemoryCredentialRepository", () => {
  credentialRepositoryContract(() => inMemory(InMemoryCredentialRepository));
});

describe("InMemoryMembershipRepository", () => {
  membershipRepositoryContract(() => inMemory(InMemoryMembershipRepository));
});

describe("InMemorySessionRepository", () => {
  sessionRepositoryContract(() => inMemory(InMemorySessionRepository));
});

describe("InMemoryPasswordResetRepository", () => {
  passwordResetRepositoryContract(() =>
    inMemory(InMemoryPasswordResetRepository),
  );
});

describe("InMemoryEmailVerificationRepository", () => {
  emailVerificationRepositoryContract(() =>
    inMemory(InMemoryEmailVerificationRepository),
  );
});
