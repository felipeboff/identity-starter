import { Account } from "@/identity/domain/account.entity";

export type AccountRepository = {
  save(account: Account): Promise<void>;
  findById(id: string): Promise<Account | null>;
  findByEmail(email: string): Promise<Account | null>;
};
