import { UseCase } from "@shared/application/use-cases";
import { AppError } from "@shared/domain/errors/app-error";

import { toOutputAccount } from "../mappers/toOutputAccount";

import {
  SignUpWithEmailDeps,
  SignUpWithEmailInput,
  SignUpWithEmailOutput,
} from "./sign-up-with-email.types";

import { Account } from "@/identity/domain/account.entity";
import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import {
  Membership,
  MembershipRole,
} from "@/identity/domain/membership.entity";

export class SignUpWithEmailUseCase extends UseCase<{
  input: SignUpWithEmailInput;
  output: SignUpWithEmailOutput;
  deps: SignUpWithEmailDeps;
}> {
  async execute(input: SignUpWithEmailInput): Promise<SignUpWithEmailOutput> {
    const existingAccount = await this.deps.accounts.findByEmail(input.email);
    if (existingAccount) {
      throw new AppError(IdentityError.AccountEmailTaken, {
        email: input.email,
      });
    }

    const existingCredential = await this.deps.credentials.findByEmail(
      input.email,
    );
    if (existingCredential) {
      throw new AppError(IdentityError.CredentialEmailTaken, {
        email: input.email,
      });
    }

    const accountId = this.deps.ids.next();
    const credentialId = this.deps.ids.next();
    const membershipId = this.deps.ids.next();
    const at = this.deps.clock.now();

    const account = Account.register(
      {
        id: accountId,
        name: input.name,
        email: input.email,
        createdBy: accountId,
      },
      at,
    );

    const passwordHash = await this.deps.passwordHasher.hash(input.password);

    const credential = Credential.register(
      {
        id: credentialId,
        accountId,
        subject: input.email,
        providerEmail: input.email,
        provider: AuthProvider.EMAIL,
        passwordHash,
      },
      at,
    );

    const membership = Membership.register(
      {
        id: membershipId,
        accountId,
        createdBy: accountId,
        role: MembershipRole.USER,
        permissions: [],
      },
      at,
    );

    await this.deps.credentials.save(credential);
    await this.deps.accounts.save(account);
    await this.deps.memberships.save(membership);

    const { accessToken, refreshToken } = await this.deps.sessionIssuer.issue(
      {
        accountId,
        credentialId,
        membershipId,
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
      },
      at,
    );

    return {
      account: toOutputAccount(account),
      accessToken,
      refreshToken,
    };
  }
}
