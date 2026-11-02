import { Clock } from "@shared/application/ports/clock";
import { IdGenerator } from "@shared/application/ports/id-generator";

import { CredentialOutput } from "../mappers/toOutputCredential";
import { CredentialRepository } from "../ports/credential.repository";
import { OAuthGateway } from "../ports/oauth-gateway";
import { AccountResolver } from "../services/account-resolver";

export type LinkOAuthInput = {
  provider: string;
  code: string;
  codeVerifier?: string;
};

export type LinkOAuthOutput = {
  credential: CredentialOutput;
};

export type LinkOAuthDeps = {
  credentials: CredentialRepository;

  oauth: OAuthGateway;

  clock: Clock;
  ids: IdGenerator;

  accountResolver: AccountResolver;
};
