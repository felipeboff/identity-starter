import { Access, UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";
import { Email } from "@shared/domain/value-objects/email.value-object";

import { toOutputMembership } from "../mappers/toOutputMembership";
import { IdentityUseCaseLogEvent } from "../use-case.log-event";

import {
  GrantAdminDeps,
  GrantAdminInput,
  GrantAdminOutput,
} from "./grant-admin.types";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import {
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";

/** Run by the operator, outside any session: there is no actor to check. */
export class GrantAdminUseCase extends UseCase<{
  input: GrantAdminInput;
  output: GrantAdminOutput;
  deps: GrantAdminDeps;
}> {
  readonly access = Access.ANYONE;

  async execute(input: GrantAdminInput): Promise<GrantAdminOutput> {
    try {
      return await this.grant(input);
    } catch (error) {
      if (error instanceof AppError) {
        this.deps.logger.warn(IdentityUseCaseLogEvent.AdminGrantFailed, {
          email: input.email,
          reason: error.code,
        });
      }
      throw error;
    }
  }

  private async grant(input: GrantAdminInput): Promise<GrantAdminOutput> {
    const email = Email.create(input.email);
    const account = await this.deps.accounts.findByEmail(email.value);
    if (!account) {
      throw new AppError(IdentityError.AccountNotFound, { email: email.value });
    }
    if (account.isDeleted()) {
      throw new AppError(IdentityError.AccountDeleted, {
        accountId: account.id.value,
      });
    }

    const membership = await this.deps.membershipResolver.resolveActive(
      account.id.value,
    );
    const at = this.deps.clock.now();
    membership.updateRole(MembershipRole.ADMIN, at);
    membership.updatePermissions(Object.values(MembershipPermission), at);
    await this.deps.memberships.save(membership);

    this.deps.logger.info(IdentityUseCaseLogEvent.AdminGranted, {
      accountId: account.id.value,
      membershipId: membership.id.value,
    });
    return { membership: toOutputMembership(membership) };
  }
}
