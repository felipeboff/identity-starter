import { Clock } from "@shared/application/ports/clock";

import { SessionRepository } from "../ports/session.repository";
import { AccountResolver } from "../services/account-resolver";
import { MembershipResolver } from "../services/membership-resolver";

import { AccountSnapshot } from "@/identity/domain/account.entity";
import { MembershipSnapshot } from "@/identity/domain/membership.entity";

export type GetMeOutput = {
  account: AccountSnapshot;
  membership: MembershipSnapshot;
};

export type GetMeDeps = {
  sessions: SessionRepository;
  clock: Clock;

  accountResolver: AccountResolver;
  membershipResolver: MembershipResolver;
};
