import { Clock } from "@shared/application/ports/clock";

import { MembershipOutput } from "../mappers/toOutputMembership";
import { MembershipRepository } from "../ports/memberships.repository";
import { MembershipResolver } from "../services/membership-resolver";

import { MembershipRole } from "@/identity/domain/membership.entity";

export type UpdateMemberRoleInput = {
  accountId: string;
  role: MembershipRole;
};

export type UpdateMemberRoleOutput = {
  membership: MembershipOutput;
};

export type UpdateMemberRoleDeps = {
  memberships: MembershipRepository;
  clock: Clock;

  membershipResolver: MembershipResolver;
};
