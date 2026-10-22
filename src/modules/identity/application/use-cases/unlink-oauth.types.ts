import { Clock } from "@shared/application/ports/clock";

import { CredentialRepository } from "../ports/credential.repository";
import { AccountResolver } from "../services/account-resolver";
import { SessionRevoker } from "../services/session-revoker";

export type UnlinkOAuthInput = {
  provider: string;
};

export type UnlinkOAuthDeps = {
  credentials: CredentialRepository;
  clock: Clock;

  accountResolver: AccountResolver;
  sessionRevoker: SessionRevoker;
};
