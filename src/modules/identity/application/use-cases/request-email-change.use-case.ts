import { Access, UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { Actor } from "../actor";
import { EMAIL_CHANGE_TTL_MS } from "../token.policy";

import {
  RequestEmailChangeDeps,
  RequestEmailChangeInput,
} from "./request-email-change.types";

import { AuthProvider } from "@/identity/domain/credential.entity";
import { EmailChange } from "@/identity/domain/email-change.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";

export class RequestEmailChangeUseCase extends UseCase<{
  input: RequestEmailChangeInput;
  deps: RequestEmailChangeDeps;
  actor: Actor;
}> {
  readonly access = Access.MEMBER;

  async execute(input: RequestEmailChangeInput, actor: Actor): Promise<void> {
    const account = await this.deps.accountResolver.resolveActive(
      actor.accountId,
    );
    const credential = (
      await this.deps.credentials.listByAccountId(account.id.value)
    ).find(
      (candidate) =>
        candidate.provider === AuthProvider.EMAIL && !candidate.isDeleted(),
    );
    if (!credential?.passwordHash) {
      throw new AppError(IdentityError.EmailChangeNeedsPassword, {
        accountId: account.id.value,
      });
    }

    const ok = await this.deps.passwordHasher.verify(
      input.password,
      credential.passwordHash.value,
    );
    if (!ok) {
      throw new AppError(IdentityError.InvalidCredentials);
    }

    const email = await this.deps.transactions.run(async () => {
      if (await this.deps.accounts.findByEmail(input.newEmail)) {
        throw new AppError(IdentityError.AccountEmailTaken, {
          email: input.newEmail,
        });
      }
      if (await this.deps.credentials.findByEmail(input.newEmail)) {
        throw new AppError(IdentityError.CredentialEmailTaken, {
          email: input.newEmail,
        });
      }

      const at = this.deps.clock.now();
      const previous = await this.deps.emailChanges.listByAccountId(
        account.id.value,
      );
      for (const change of previous.filter((p) => p.isPending(at))) {
        change.markAsDeleted(at);
        await this.deps.emailChanges.save(change);
      }

      const { token, tokenHash } = this.deps.tokens.issue();
      const expiresAt = new Date(at.getTime() + EMAIL_CHANGE_TTL_MS);
      await this.deps.emailChanges.save(
        EmailChange.register(
          {
            id: this.deps.ids.next(),
            accountId: account.id.value,
            newEmail: input.newEmail,
            tokenHash,
            expiresAt,
          },
          at,
        ),
      );

      return { to: input.newEmail, name: account.name, token, expiresAt };
    });

    await this.deps.mailer.sendEmailChange(email);
  }
}
