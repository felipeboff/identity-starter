import {
  Membership,
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";

export type MembershipOutput = {
  id: string;
  accountId: string;
  role: MembershipRole;
  permissions: MembershipPermission[];
  updatedAt: Date;
};

export const toOutputMembership = (
  membership: Membership,
): MembershipOutput => ({
  id: membership.id.value,
  accountId: membership.accountId.value,
  role: membership.role,
  permissions: membership.permissions,
  updatedAt: membership.updatedAt,
});
