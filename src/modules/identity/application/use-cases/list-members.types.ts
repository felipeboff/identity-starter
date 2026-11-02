import type { PageRequest } from "@shared/application/pagination.policy";
import { CursorPager } from "@shared/application/services/cursor-pager";

import { AccountOutput } from "../mappers/toOutputAccount";
import { MembershipOutput } from "../mappers/toOutputMembership";
import { AccountRepository } from "../ports/account.repository";
import { MembershipRepository } from "../ports/memberships.repository";

export type ListMembersInput = PageRequest;

export type ListedMember = {
  account: AccountOutput;
  membership: MembershipOutput;
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
