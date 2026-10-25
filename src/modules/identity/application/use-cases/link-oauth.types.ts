import { Clock } from "@shared/application/ports/clock";
import { IdGenerator } from "@shared/application/ports/id-generator";

import { PublicCredential } from "../mappers/toPublicCredential";
import { CredentialRepository } from "../ports/credential.repository";
import { OAuthGateway } from "../ports/oauth-gateway";
import { AccountResolver } from "../services/account-resolver";

export type LinkOAuthInput = {
  provider: string;
  code: string;
  codeVerifier?: string;
};

export type LinkOAuthOutput = {
  credential: PublicCredential;
};

export type LinkOAuthDeps = {
  credentials: CredentialRepository;

  oauth: OAuthGateway;

  clock: Clock;
  ids: IdGenerator;

  accountResolver: AccountResolver;
};
