import type { PageRequest } from "@shared/application/pagination.policy";
import { CursorPager } from "@shared/application/services/cursor-pager";

import { AccountRepository } from "../ports/account.repository";
import { MembershipRepository } from "../ports/memberships.repository";

import { AccountSnapshot } from "@/identity/domain/account.entity";
import { MembershipSnapshot } from "@/identity/domain/membership.entity";

export type ListMembersInput = PageRequest;

export type ListedMember = {
  account: AccountSnapshot;
  membership: MembershipSnapshot;
};

export type ListMembersOutput = {
  members: ListedMember[];
  nextCursor: string | null;
};

export type ListMembersDeps = {
  memberships: MembershipRepository;
  accounts: AccountRepository;

  pager: CursorPager;
};
