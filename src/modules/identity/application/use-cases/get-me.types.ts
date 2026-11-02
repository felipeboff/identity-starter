import { Clock } from "@shared/application/ports/clock";

import { AccountOutput } from "../mappers/toOutputAccount";
import { MembershipOutput } from "../mappers/toOutputMembership";
import { SessionRepository } from "../ports/session.repository";
import { AccountResolver } from "../services/account-resolver";
import { MembershipResolver } from "../services/membership-resolver";

export type GetMeOutput = {
  account: AccountOutput;
  membership: MembershipOutput;
};

export type GetMeDeps = {
  sessions: SessionRepository;
  clock: Clock;

  accountResolver: AccountResolver;
  membershipResolver: MembershipResolver;
};
