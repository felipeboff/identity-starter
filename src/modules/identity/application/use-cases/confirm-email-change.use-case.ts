import { Access, UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { toOutputAccount } from "../mappers/toOutputAccount";
import { IdentityUseCaseLogEvent } from "../use-case.log-event";

import {
  ConfirmEmailChangeDeps,
  ConfirmEmailChangeInput,
  ConfirmEmailChangeOutput,
} from "./confirm-email-change.types";

import { AuthProvider } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

export class ConfirmEmailChangeUseCase extends UseCase<{
  input: ConfirmEmailChangeInput;
  output: ConfirmEmailChangeOutput;
  deps: ConfirmEmailChangeDeps;
}> {
  readonly access = Access.ANYONE;

  async execute(
    input: ConfirmEmailChangeInput,
  ): Promise<ConfirmEmailChangeOutput> {
    const changed = await this.deps.transactions.run(async () => {
      const change = await this.deps.emailChanges.findByTokenHash(
        this.deps.tokens.hash(input.token),
      );
      if (!change) {
        throw new AppError(IdentityError.InvalidEmailChangeToken);
      }
      if (change.isConsumed()) {
        throw new AppError(IdentityError.EmailChangeAlreadyConsumed);
      }

      const at = this.deps.clock.now();
      change.consume(at);

      const account = await this.deps.accountResolver.resolveActive(
        change.accountId.value,
      );
      const newEmail = change.newEmail.value;
      if (await this.deps.accounts.findByEmail(newEmail)) {
        throw new AppError(IdentityError.AccountEmailTaken, {
          email: newEmail,
        });
      }
      const credential = (
        await this.deps.credentials.listByAccountId(account.id.value)
      ).find(
        (candidate) =>
          candidate.provider === AuthProvider.EMAIL && !candidate.isDeleted(),
      );
      if (!credential) {
        throw new AppError(IdentityError.EmailChangeNeedsPassword, {
          accountId: account.id.value,
        });
      }

      const oldEmail = account.email.value;
      account.changeEmail(newEmail, at);
      credential.changeEmail(newEmail, at);

      await this.deps.emailChanges.save(change);
      await this.deps.accounts.save(account);
      await this.deps.credentials.save(credential);
      await this.deps.sessionRevoker.revokeActive(account.id.value, {
        reason: SessionRevocationReason.EMAIL_CHANGED,
        at,
      });

      return {
        account,
        notice: { to: oldEmail, name: account.name, newEmail },
      };
    });
    this.deps.logger.info(IdentityUseCaseLogEvent.EmailChanged, {
      accountId: changed.account.id.value,
      oldEmail: changed.notice.to,
      newEmail: changed.notice.newEmail,
    });

    await this.deps.mailer
      .sendEmailChanged(changed.notice)
      .catch((error: unknown) => {
        this.deps.logger.warn(
          IdentityUseCaseLogEvent.EmailChangedNoticeNotSent,
          { accountId: changed.account.id.value, error },
        );
      });

    return { account: toOutputAccount(changed.account) };
  }
}
