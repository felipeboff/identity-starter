import { Clock } from "@shared/application/ports/clock";

import { AccessPolicy } from "../policies/access.policy";
import { MembershipRepository } from "../ports/memberships.repository";
import { MembershipResolver } from "../services/membership-resolver";

import {
  MembershipRole,
  MembershipSnapshot,
} from "@/identity/domain/membership.entity";

export type UpdateMemberRoleInput = {
  accountId: string;
  role: MembershipRole;
};

export type UpdateMemberRoleOutput = {
  membership: MembershipSnapshot;
};

export type UpdateMemberRoleDeps = {
  memberships: MembershipRepository;
  clock: Clock;

  membershipResolver: MembershipResolver;
  accessPolicy: AccessPolicy;
};
