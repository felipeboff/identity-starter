import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { SignUpWithEmailUseCase } from "./sign-up-with-email.use-case";

import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import { MembershipRole } from "@/identity/domain/membership.entity";

describe("SignUpWithEmailUseCase", () => {
  let ctx: IdentityContext;
  let useCase: SignUpWithEmailUseCase;

  const makeInput = () => ({
    name: faker.person.fullName(),
    email: faker.internet.email().toLowerCase(),
    password: faker.internet.password(),
    userAgent: faker.internet.userAgent(),
    ipAddress: faker.internet.ip(),
  });

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new SignUpWithEmailUseCase(ctx);
  });

  it("creates the account with an e-mail credential, a user membership and a session", async () => {
    const input = makeInput();

    const output = await useCase.execute(input);

    const accountId = output.account.id;
    expect(output.account).toMatchObject({
      name: input.name,
      email: input.email,
      createdBy: accountId,
      deletedAt: null,
    });

    const [credential] = await ctx.credentials.listByAccountId(accountId);
    expect(credential.toSnapshot()).toMatchObject({
      provider: AuthProvider.EMAIL,
      subject: input.email,
      passwordHash: `$fake$${input.password}`,
    });

    const membership = await ctx.memberships.findByAccountId(accountId);
    expect(membership?.toSnapshot()).toMatchObject({
      role: MembershipRole.USER,
      permissions: [],
    });

    const session = await ctx.sessions.findByTokenHash(
      ctx.tokens.hash(output.refreshToken),
    );
    expect(session?.toSnapshot()).toMatchObject({
      accountId,
      credentialId: credential.id.value,
      membershipId: membership?.id.value,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    });
    expect(output.accessToken).toBe(`access:${accountId}:${session?.id.value}`);
  });

  it("throws AccountEmailTaken when an account already uses the e-mail", async () => {
    const ana = await seedAccount(ctx);

    await expectAppError(
      useCase.execute({ ...makeInput(), email: ana.email }),
      IdentityError.AccountEmailTaken,
      { email: ana.email },
    );
  });

  it("throws CredentialEmailTaken when a credential already uses the e-mail", async () => {
    const email = faker.internet.email().toLowerCase();
    // A credential whose account no longer exists still blocks the e-mail.
    const orphan = Credential.register(
      {
        id: faker.database.mongodbObjectId(),
        accountId: faker.database.mongodbObjectId(),
        provider: AuthProvider.EMAIL,
        subject: email,
        providerEmail: email,
        passwordHash: `$fake$${faker.internet.password()}`,
      },
      ctx.clock.now(),
    );
    await ctx.credentials.save(orphan);

    await expectAppError(
      useCase.execute({ ...makeInput(), email }),
      IdentityError.CredentialEmailTaken,
      { email },
    );
  });
});
