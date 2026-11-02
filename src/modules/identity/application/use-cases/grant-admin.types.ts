import { Clock } from "@shared/application/ports/clock";
import type { Logger } from "@shared/application/ports/logger";

import { AccountRepository } from "../ports/account.repository";
import { MembershipRepository } from "../ports/memberships.repository";
import { MembershipResolver } from "../services/membership-resolver";

import { MembershipSnapshot } from "@/identity/domain/membership.entity";

export type GrantAdminInput = {
  email: string;
};

export type GrantAdminOutput = {
  membership: MembershipSnapshot;
};

export type GrantAdminDeps = {
  accounts: AccountRepository;
  memberships: MembershipRepository;
  clock: Clock;
  logger: Logger;

  membershipResolver: MembershipResolver;
};
