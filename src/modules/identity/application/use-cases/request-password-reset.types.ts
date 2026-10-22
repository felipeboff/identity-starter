import { Clock } from "@shared/application/ports/clock";
import { IdGenerator } from "@shared/application/ports/id-generator";

import { AccountRepository } from "../ports/account.repository";
import { CredentialRepository } from "../ports/credential.repository";
import { IdentityMailer } from "../ports/identity-mailer";
import { PasswordResetRepository } from "../ports/password-reset.repository";
import { TokenIssuer } from "../ports/token-issuer";

export type RequestPasswordResetInput = {
  email: string;
};

export type RequestPasswordResetDeps = {
  accounts: AccountRepository;
  credentials: CredentialRepository;
  passwordResets: PasswordResetRepository;

  tokens: TokenIssuer;
  mailer: IdentityMailer;

  clock: Clock;
  ids: IdGenerator;
};
