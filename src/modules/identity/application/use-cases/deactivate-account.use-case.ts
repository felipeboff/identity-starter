import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { Actor } from "../actor";

import {
  DeactivateAccountDeps,
  DeactivateAccountInput,
} from "./deactivate-account.types";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

/** Soft-deletes the account and revokes its sessions. Owner or admin. */
export class DeactivateAccountUseCase extends UseCase<{
  input: DeactivateAccountInput;
  deps: DeactivateAccountDeps;
  actor: Actor;
}> {
  async execute(input: DeactivateAccountInput, actor: Actor): Promise<void> {
    return this.deps.transactions.run(async () => {
      this.deps.accessPolicy.ensureCanManageAccount(actor, input.accountId);

      const account = await this.deps.accounts.findById(input.accountId);
      if (!account) {
        throw new AppError(IdentityError.AccountNotFound, {
          accountId: input.accountId,
        });
      }

      const at = this.deps.clock.now();
      account.markAsDeleted(at);
      await this.deps.accounts.save(account);

      await this.deps.sessionRevoker.revokeActive(account.id.value, {
        reason: SessionRevocationReason.SECURITY,
        at,
        revokedBy: actor.accountId,
      });
    });
  }
}
