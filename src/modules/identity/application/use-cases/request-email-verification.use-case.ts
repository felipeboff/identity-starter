import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { Actor } from "../actor";

import { RequestEmailVerificationDeps } from "./request-email-verification.types";

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

    return this.deps.emailVerificationIssuer.issue(account);
  }
}
