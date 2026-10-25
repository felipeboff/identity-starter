import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { Actor } from "../actor";
import { EMAIL_VERIFICATION_TTL_MS } from "../token.policy";

import { RequestEmailVerificationDeps } from "./request-email-verification.types";

import { EmailVerification } from "@/identity/domain/email-verification.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";

export class RequestEmailVerificationUseCase extends UseCase<{
  deps: RequestEmailVerificationDeps;
  actor: Actor;
}> {
  async execute(actor: Actor): Promise<void> {
    const email = await this.deps.transactions.run(() => this.issue(actor));
    await this.deps.mailer.sendEmailVerification(email);
  }

  private async issue(actor: Actor) {
    const account = await this.deps.accountResolver.resolveActive(
      actor.accountId,
    );
    if (account.isEmailVerified()) {
      throw new AppError(IdentityError.AccountEmailAlreadyVerified, {
        accountId: account.id.value,
      });
    }

    const at = this.deps.clock.now();

    const previous = await this.deps.emailVerifications.listByAccountId(
      account.id.value,
    );
    for (const verification of previous.filter((v) => v.isPending(at))) {
      verification.markAsDeleted(at);
      await this.deps.emailVerifications.save(verification);
    }

    const { token, tokenHash } = this.deps.tokens.issue();
    const expiresAt = new Date(at.getTime() + EMAIL_VERIFICATION_TTL_MS);

    const verification = EmailVerification.register(
      {
        id: this.deps.ids.next(),
        accountId: account.id.value,
        tokenHash,
        expiresAt,
      },
      at,
    );
    await this.deps.emailVerifications.save(verification);

    return {
      to: account.email.value,
      name: account.name,
      token,
      expiresAt,
    };
  }
}
