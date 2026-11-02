import { Account } from "@/identity/domain/account.entity";

export type AccountOutput = {
  id: string;
  name: string;
  email: string;
  emailVerifiedAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
  deactivatedAt: Date | null;
};

export const toOutputAccount = (account: Account): AccountOutput => ({
  id: account.id.value,
  name: account.name,
  email: account.email.value,
  emailVerifiedAt: account.emailVerifiedAt,
  lastSeenAt: account.lastSeenAt,
  createdAt: account.createdAt,
  deactivatedAt: account.deletedAt,
});
