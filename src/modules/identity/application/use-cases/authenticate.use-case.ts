import { Access, UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { Actor } from "../actor";

import { AuthenticateDeps, AuthenticateInput } from "./authenticate.types";

import { IdentityError } from "@/identity/domain/errors/identity.error";

export class AuthenticateUseCase extends UseCase<{
  input: AuthenticateInput;
  output: Actor;
  deps: AuthenticateDeps;
}> {
  readonly access = Access.ANYONE;

  async execute(input: AuthenticateInput): Promise<Actor> {
    const claims = await this.deps.accessToken.verify(input.accessToken);
    if (!claims) throw new AppError(IdentityError.InvalidAccessToken);

    const session = await this.deps.sessions.findById(claims.sessionId);
    if (
      !session ||
      session.accountId.value !== claims.accountId ||
      !session.isActive(this.deps.clock.now())
    ) {
      throw new AppError(IdentityError.InvalidAccessToken);
    }

    const account = await this.deps.accounts.findById(claims.accountId);
    if (!account || account.isDeleted()) {
      throw new AppError(IdentityError.InvalidAccessToken);
    }

    const membership = await this.deps.memberships.findByAccountId(
      claims.accountId,
    );
    if (!membership || membership.isDeleted()) {
      throw new AppError(IdentityError.InvalidAccessToken);
    }

    return {
      accountId: claims.accountId,
      sessionId: claims.sessionId,
      membershipId: membership.id.value,
      role: membership.role,
      permissions: membership.permissions,
    };
  }
}
