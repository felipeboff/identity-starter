import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { Actor } from "../actor";
import { toOutputAccount } from "../mappers/toOutputAccount";

import {
  ReactivateAccountDeps,
  ReactivateAccountInput,
  ReactivateAccountOutput,
} from "./reactivate-account.types";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { MembershipPermission } from "@/identity/domain/membership.entity";

/** A deactivated account cannot sign in to reactivate itself. */
export class ReactivateAccountUseCase extends UseCase<{
  input: ReactivateAccountInput;
  output: ReactivateAccountOutput;
  deps: ReactivateAccountDeps;
  actor: Actor;
}> {
  readonly permissions = [MembershipPermission.ACCOUNT_REACTIVATE];

  async execute(
    input: ReactivateAccountInput,
    _actor: Actor,
  ): Promise<ReactivateAccountOutput> {
    const account = await this.deps.accounts.findById(input.accountId);
    if (!account) {
      throw new AppError(IdentityError.AccountNotFound, {
        accountId: input.accountId,
      });
    }

    account.reactivate(this.deps.clock.now());
    await this.deps.accounts.save(account);

    return { account: toOutputAccount(account) };
  }
}
