import {
  Membership,
  MembershipSnapshot,
} from "@/identity/domain/membership.entity";

export const toOutputMembership = (
  membership: Membership,
): MembershipSnapshot => {
  return membership.toSnapshot();
};
