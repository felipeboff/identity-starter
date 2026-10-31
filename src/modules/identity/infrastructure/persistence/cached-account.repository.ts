import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import { EntityCache } from "@shared/infrastructure/cache/entity-cache";
import { FailOpenCache } from "@shared/infrastructure/cache/fail-open-cache";

import {
  AccountCacheEntry,
  accountCacheMapper,
} from "./mappers/account-cache.mapper";

import { AccountRepository } from "@/identity/application/ports/account.repository";
import { Account } from "@/identity/domain/account.entity";

export type CachedAccountRepositoryDeps = Readonly<{
  inner: AccountRepository;
  cache: FailOpenCache;
  transactions: TransactionRunner;
  ttlMs: number;
}>;

export class CachedAccountRepository implements AccountRepository {
  private readonly entities: EntityCache<Account, AccountCacheEntry>;

  constructor(private readonly deps: CachedAccountRepositoryDeps) {
    this.entities = new EntityCache({
      cache: deps.cache,
      transactions: deps.transactions,
      ttlMs: deps.ttlMs,
      namespace: "identity:account",
      restore: (entry) => accountCacheMapper.toDomain(entry),
    });
  }

  async save(account: Account): Promise<void> {
    await this.deps.inner.save(account);
    this.entities.forget(account);
  }

  findById(id: string): Promise<Account | null> {
    return this.entities.findById(id, () => this.deps.inner.findById(id));
  }

  findByEmail(email: string): Promise<Account | null> {
    const normalized = email.toLowerCase();
    return this.entities.findBy({
      index: "email",
      value: normalized,
      matches: (account) => account.email.value === normalized,
      load: () => this.deps.inner.findByEmail(email),
    });
  }
}
