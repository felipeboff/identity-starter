import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import { EntityCache } from "@shared/infrastructure/cache/entity-cache";
import { FailOpenCache } from "@shared/infrastructure/cache/fail-open-cache";

import {
  MembershipCacheEntry,
  membershipCacheMapper,
} from "./mappers/membership-cache.mapper";

import { MembershipRepository } from "@/identity/application/ports/memberships.repository";
import { Membership } from "@/identity/domain/membership.entity";

export type CachedMembershipRepositoryDeps = Readonly<{
  inner: MembershipRepository;
  cache: FailOpenCache;
  transactions: TransactionRunner;
  ttlMs: number;
}>;

export class CachedMembershipRepository implements MembershipRepository {
  private readonly entities: EntityCache<Membership, MembershipCacheEntry>;

  constructor(private readonly deps: CachedMembershipRepositoryDeps) {
    this.entities = new EntityCache({
      cache: deps.cache,
      transactions: deps.transactions,
      ttlMs: deps.ttlMs,
      namespace: "identity:membership",
      restore: (entry) => membershipCacheMapper.toDomain(entry),
    });
  }

  async save(membership: Membership): Promise<void> {
    await this.deps.inner.save(membership);
    this.entities.forget(membership);
  }

  findById(id: string): Promise<Membership | null> {
    return this.entities.findById(id, () => this.deps.inner.findById(id));
  }

  findByAccountId(accountId: string): Promise<Membership | null> {
    return this.entities.findBy({
      index: "account",
      value: accountId,
      matches: (membership) => membership.accountId.value === accountId,
      load: () => this.deps.inner.findByAccountId(accountId),
    });
  }
}
