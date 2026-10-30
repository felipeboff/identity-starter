import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { toOutputAccount } from "../mappers/toOutputAccount";

import {
  AcceptInvitationDeps,
  AcceptInvitationInput,
  AcceptInvitationOutput,
} from "./accept-invitation.types";

import { Account } from "@/identity/domain/account.entity";
import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import { Membership } from "@/identity/domain/membership.entity";

export class AcceptInvitationUseCase extends UseCase<{
  input: AcceptInvitationInput;
  output: AcceptInvitationOutput;
  deps: AcceptInvitationDeps;
}> {
  async execute(input: AcceptInvitationInput): Promise<AcceptInvitationOutput> {
    const passwordHash = await this.deps.passwordHasher.hash(input.password);

    const accepted = await this.deps.transactions.run(async () => {
      const invitation = await this.deps.invitations.findByTokenHash(
        this.deps.tokens.hash(input.token),
      );
      if (!invitation) {
        throw new AppError(IdentityError.InvalidInvitationToken);
      }
      if (invitation.isAccepted()) {
        throw new AppError(IdentityError.InvitationAlreadyAccepted);
      }

      const email = invitation.email.value;
      if (await this.deps.accounts.findByEmail(email)) {
        throw new AppError(IdentityError.AccountEmailTaken, { email });
      }

      const at = this.deps.clock.now();
      const accountId = this.deps.ids.next();
      invitation.accept(accountId, at);

      const account = Account.register(
        {
          id: accountId,
          name: input.name,
          email,
          createdBy: invitation.createdBy.value,
        },
        at,
      );
      account.markEmailAsVerified(at);
      const credential = Credential.register(
        {
          id: this.deps.ids.next(),
          accountId,
          provider: AuthProvider.EMAIL,
          subject: email,
          providerEmail: email,
          passwordHash,
        },
        at,
      );
      const membership = Membership.register(
        {
          id: this.deps.ids.next(),
          accountId,
          createdBy: invitation.createdBy.value,
          role: invitation.role,
          permissions: invitation.permissions,
        },
        at,
      );

      await this.deps.invitations.save(invitation);
      await this.deps.credentials.save(credential);
      await this.deps.accounts.save(account);
      await this.deps.memberships.save(membership);

      const issued = await this.deps.sessionIssuer.issue(
        {
          accountId,
          credentialId: credential.id.value,
          membershipId: membership.id.value,
          userAgent: input.userAgent,
          ipAddress: input.ipAddress,
        },
        at,
      );

      return { account, issued };
    });

    return {
      account: toOutputAccount(accepted.account),
      accessToken: accepted.issued.accessToken,
      refreshToken: accepted.issued.refreshToken,
    };
  }
}
