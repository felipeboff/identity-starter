import { Clock } from "@shared/application/ports/clock";

import { AccountRepository } from "../ports/account.repository";
import { CredentialRepository } from "../ports/credential.repository";
import { MembershipRepository } from "../ports/memberships.repository";
import { PasswordHasher } from "../ports/password-hasher";
import { SessionIssuer } from "../services/session-issuer";

import { AccountSnapshot } from "@/identity/domain/account.entity";

export type SignInWithEmailInput = {
  email: string;
  password: string;
  userAgent: string;
  ipAddress: string;
};

export type SignInWithEmailOutput = {
  account: AccountSnapshot;

  accessToken: string;
  refreshToken: string;
};

export type SignInWithEmailDeps = {
  accounts: AccountRepository;
  credentials: CredentialRepository;
  memberships: MembershipRepository;

  passwordHasher: PasswordHasher;
  sessionIssuer: SessionIssuer;

  clock: Clock;
};
