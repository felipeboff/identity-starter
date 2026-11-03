import { MembershipRole } from "@/identity/domain/membership.entity";

/** Who is calling an authenticated use case. Built once at the edge. */
export type Actor = Readonly<{
  accountId: string;
  sessionId: string;
  membershipId: string;
  /** A label to show; no access rule reads it. */
  role: MembershipRole;
  permissions: readonly string[];
}>;
