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

describe("InMemoryAccountRepository", () => {
  accountRepositoryContract(() => new InMemoryAccountRepository());
});

describe("InMemoryCredentialRepository", () => {
  credentialRepositoryContract(() => new InMemoryCredentialRepository());
});

describe("InMemoryMembershipRepository", () => {
  membershipRepositoryContract(() => new InMemoryMembershipRepository());
});

describe("InMemorySessionRepository", () => {
  sessionRepositoryContract(() => new InMemorySessionRepository());
});

describe("InMemoryPasswordResetRepository", () => {
  passwordResetRepositoryContract(() => new InMemoryPasswordResetRepository());
});

describe("InMemoryEmailVerificationRepository", () => {
  emailVerificationRepositoryContract(
    () => new InMemoryEmailVerificationRepository(),
  );
});
