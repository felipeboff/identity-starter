import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { toOutputAccount } from "../mappers/toOutputAccount";

import {
  VerifyEmailDeps,
  VerifyEmailInput,
  VerifyEmailOutput,
} from "./verify-email.types";

import { IdentityError } from "@/identity/domain/errors/identity.error";

export class VerifyEmailUseCase extends UseCase<{
  input: VerifyEmailInput;
  output: VerifyEmailOutput;
  deps: VerifyEmailDeps;
}> {
  async execute(input: VerifyEmailInput): Promise<VerifyEmailOutput> {
    const account = await this.deps.transactions.run(async () => {
      const at = this.deps.clock.now();

      const verification = await this.deps.emailVerifications.findByTokenHash(
        this.deps.tokens.hash(input.token),
      );
      if (!verification) {
        throw new AppError(IdentityError.InvalidEmailVerificationToken);
      }
      if (verification.isConsumed()) {
        throw new AppError(IdentityError.EmailVerificationAlreadyConsumed);
      }
      verification.consume(at);

      const account = await this.deps.accountResolver.resolveActive(
        verification.accountId.value,
      );
      account.markEmailAsVerified(at);

      await this.deps.emailVerifications.save(verification);
      await this.deps.accounts.save(account);

      return account;
    });

    return { account: toOutputAccount(account) };
  }
}
