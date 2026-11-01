import type { PageQuery } from "@shared/application/pagination.policy";

import { Membership } from "@/identity/domain/membership.entity";

export type MembershipRepository = {
  save(membership: Membership): Promise<void>;
  findById(id: string): Promise<Membership | null>;
  findByAccountId(accountId: string): Promise<Membership | null>;
  list(query: PageQuery): Promise<Membership[]>;
};
