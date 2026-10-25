import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";

import { AuthenticateUseCase } from "./authenticate.use-case";

import { Account } from "@/identity/domain/account.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import {
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

describe("AuthenticateUseCase", () => {
  let ctx: IdentityContext;
  let useCase: AuthenticateUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new AuthenticateUseCase(ctx);
  });

  const tokenFor = (accountId: string, sessionId: string) =>
    ctx.accessToken.issue({ accountId, sessionId });

  it("returns the caller's actor for an active session", async () => {
    const ana = await seedAccount(ctx, { role: MembershipRole.ADMIN });
    ana.membership.updatePermissions(
      [MembershipPermission.READ, MembershipPermission.WRITE],
      ctx.clock.now(),
    );
    await ctx.memberships.save(ana.membership);
    const { session } = await seedSession(ctx, ana);

    const actor = await useCase.execute({
      accessToken: await tokenFor(ana.accountId, session.id.value),
    });

    expect(actor).toEqual({
      accountId: ana.accountId,
      sessionId: session.id.value,
      membershipId: ana.membership.id.value,
      role: MembershipRole.ADMIN,
      permissions: [MembershipPermission.READ, MembershipPermission.WRITE],
    });
  });

  it("rejects a token the AccessToken port does not recognise", async () => {
    await expectAppError(
      useCase.execute({ accessToken: faker.string.alphanumeric(40) }),
      IdentityError.InvalidAccessToken,
    );
  });

  describe("rejects the token of a session that is", () => {
    it("missing", async () => {
      const ana = await seedAccount(ctx);

      await expectAppError(
        useCase.execute({
          accessToken: await tokenFor(
            ana.accountId,
            faker.database.mongodbObjectId(),
          ),
        }),
        IdentityError.InvalidAccessToken,
      );
    });

    it("of another account", async () => {
      const ana = await seedAccount(ctx);
      const bruno = await seedAccount(ctx);
      const { session: brunoSession } = await seedSession(ctx, bruno);

      await expectAppError(
        useCase.execute({
          accessToken: await tokenFor(ana.accountId, brunoSession.id.value),
        }),
        IdentityError.InvalidAccessToken,
      );
    });

    it("revoked", async () => {
      const ana = await seedAccount(ctx);
      const { session } = await seedSession(ctx, ana);
      session.revoke(SessionRevocationReason.LOGOUT, ctx.clock.now());
      await ctx.sessions.save(session);

      await expectAppError(
        useCase.execute({
          accessToken: await tokenFor(ana.accountId, session.id.value),
        }),
        IdentityError.InvalidAccessToken,
      );
    });

    it("expired", async () => {
      const ana = await seedAccount(ctx);
      const { session } = await seedSession(ctx, ana, { ttlMs: 1_000 });
      ctx.clock.advance(1_000);

      await expectAppError(
        useCase.execute({
          accessToken: await tokenFor(ana.accountId, session.id.value),
        }),
        IdentityError.InvalidAccessToken,
      );
    });
  });

  describe("rejects the token when the", () => {
    it("account is missing", async () => {
      // Seeded elsewhere: only the session lives in this context.
      const ghost = await seedAccount(createIdentityContext());
      const { session } = await seedSession(ctx, ghost);

      await expectAppError(
        useCase.execute({
          accessToken: await tokenFor(ghost.accountId, session.id.value),
        }),
        IdentityError.InvalidAccessToken,
      );
    });

    it("account is deleted", async () => {
      const ana = await seedAccount(ctx);
      const { session } = await seedSession(ctx, ana);
      ana.account.markAsDeleted(ctx.clock.now());
      await ctx.accounts.save(ana.account);

      await expectAppError(
        useCase.execute({
          accessToken: await tokenFor(ana.accountId, session.id.value),
        }),
        IdentityError.InvalidAccessToken,
      );
    });

    it("membership is missing", async () => {
      const ghost = await seedAccount(createIdentityContext());
      await ctx.accounts.save(
        Account.restore({ ...ghost.account.toSnapshot(), version: 0 }),
      );
      const { session } = await seedSession(ctx, ghost);

      await expectAppError(
        useCase.execute({
          accessToken: await tokenFor(ghost.accountId, session.id.value),
        }),
        IdentityError.InvalidAccessToken,
      );
    });

    it("membership is deleted", async () => {
      const ana = await seedAccount(ctx);
      const { session } = await seedSession(ctx, ana);
      ana.membership.markAsDeleted(ctx.clock.now());
      await ctx.memberships.save(ana.membership);

      await expectAppError(
        useCase.execute({
          accessToken: await tokenFor(ana.accountId, session.id.value),
        }),
        IdentityError.InvalidAccessToken,
      );
    });
  });
});
