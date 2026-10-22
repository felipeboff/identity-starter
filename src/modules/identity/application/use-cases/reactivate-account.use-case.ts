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

/** Admin-only: a deactivated account cannot sign in to reactivate itself. */
export class ReactivateAccountUseCase extends UseCase<{
  input: ReactivateAccountInput;
  output: ReactivateAccountOutput;
  deps: ReactivateAccountDeps;
  actor: Actor;
}> {
  async execute(
    input: ReactivateAccountInput,
    actor: Actor,
  ): Promise<ReactivateAccountOutput> {
    this.deps.accessPolicy.ensureAdmin(actor);

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
