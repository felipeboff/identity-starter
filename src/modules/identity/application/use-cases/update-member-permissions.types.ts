import { Clock } from "@shared/application/ports/clock";

import { MembershipOutput } from "../mappers/toOutputMembership";
import { AccessPolicy } from "../policies/access.policy";
import { MembershipRepository } from "../ports/memberships.repository";
import { MembershipResolver } from "../services/membership-resolver";

import { MembershipPermission } from "@/identity/domain/membership.entity";

export type UpdateMemberPermissionsInput = {
  accountId: string;
  permissions: MembershipPermission[];
};

export type UpdateMemberPermissionsOutput = {
  membership: MembershipOutput;
};

export type UpdateMemberPermissionsDeps = {
  memberships: MembershipRepository;
  clock: Clock;

  membershipResolver: MembershipResolver;
  accessPolicy: AccessPolicy;
};
