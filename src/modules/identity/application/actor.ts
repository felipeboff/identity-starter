import {
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";

/** Who is calling an authenticated use case. Built once at the edge. */
export type Actor = Readonly<{
  accountId: string;
  sessionId: string;
  membershipId: string;
  role: MembershipRole;
  permissions: readonly MembershipPermission[];
}>;
