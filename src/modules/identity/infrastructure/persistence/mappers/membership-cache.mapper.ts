import { Replace } from "@shared/types/replace";

import {
  Membership,
  MembershipSnapshot,
} from "@/identity/domain/membership.entity";

export type MembershipCacheEntry = Replace<
  MembershipSnapshot,
  {
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
  }
>;

export const membershipCacheMapper = {
  toDomain(entry: MembershipCacheEntry): Membership {
    return Membership.restore({
      ...entry,
      createdAt: new Date(entry.createdAt),
      updatedAt: new Date(entry.updatedAt),
      deletedAt: entry.deletedAt === null ? null : new Date(entry.deletedAt),
    });
  },
};
