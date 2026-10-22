import { Account, AccountSnapshot } from "@/identity/domain/account.entity";

export const toOutputAccount = (account: Account): AccountSnapshot => {
  return account.toSnapshot();
};
