import { AppError } from "@shared/domain/errors/app-error";

import { MembershipRepository } from "../ports/memberships.repository";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { Membership } from "@/identity/domain/membership.entity";

type MembershipResolverDeps = {
  memberships: MembershipRepository;
};

/** Turns an account id into its membership, which must exist and not be deleted. */
export class MembershipResolver {
  constructor(private readonly deps: MembershipResolverDeps) {}

  async resolveActive(accountId: string): Promise<Membership> {
    const membership = await this.deps.memberships.findByAccountId(accountId);
    if (!membership) {
      throw new AppError(IdentityError.MembershipNotFound, { accountId });
    }
    if (membership.isDeleted()) {
      throw new AppError(IdentityError.MembershipDeleted, {
        membershipId: membership.id.value,
      });
    }
    return membership;
  }
}
