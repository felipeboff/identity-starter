import { Replace } from "@shared/types/replace";

import { Account, AccountSnapshot } from "@/identity/domain/account.entity";

export type AccountCacheEntry = Replace<
  AccountSnapshot,
  {
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    lastSeenAt: string | null;
    emailVerifiedAt: string | null;
  }
>;

export const accountCacheMapper = {
  toDomain(entry: AccountCacheEntry): Account {
    return Account.restore({
      ...entry,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
      deletedAt: entry.deletedAt === null ? null : new Date(entry.deletedAt),
      lastSeenAt: entry.lastSeenAt === null ? null : new Date(entry.lastSeenAt),
      emailVerifiedAt:
        entry.emailVerifiedAt === null ? null : new Date(entry.emailVerifiedAt),
    });
  },
};
