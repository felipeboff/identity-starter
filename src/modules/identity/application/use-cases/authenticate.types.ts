import { Clock } from "@shared/application/ports/clock";

import { AccessToken } from "../ports/access-token";
import { AccountRepository } from "../ports/account.repository";
import { MembershipRepository } from "../ports/memberships.repository";
import { SessionRepository } from "../ports/session.repository";

export type AuthenticateInput = {
  accessToken: string;
};

export type AuthenticateDeps = {
  accessToken: AccessToken;
  sessions: SessionRepository;
  accounts: AccountRepository;
  memberships: MembershipRepository;
  clock: Clock;
};
