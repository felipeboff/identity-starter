import { AppError } from "@shared/domain/errors/app-error";

import { AccountRepository } from "../ports/account.repository";

import { Account } from "@/identity/domain/account.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";

type AccountResolverDeps = {
  accounts: AccountRepository;
};

/** Turns an account id into an account that exists and is not deleted. */
export class AccountResolver {
  constructor(private readonly deps: AccountResolverDeps) {}

  async resolveActive(accountId: string): Promise<Account> {
    const account = await this.deps.accounts.findById(accountId);
    if (!account) {
      throw new AppError(IdentityError.AccountNotFound, { accountId });
    }
    if (account.isDeleted()) {
      throw new AppError(IdentityError.AccountDeleted, { accountId });
    }
    return account;
  }
}
