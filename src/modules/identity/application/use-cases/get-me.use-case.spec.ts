import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import { toOutputMembership } from "../mappers/toOutputMembership";
import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";

import { GetMeUseCase } from "./get-me.use-case";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

describe("GetMeUseCase", () => {
  let ctx: IdentityContext;
  let useCase: GetMeUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new GetMeUseCase(ctx);
  });

  it("returns the account and membership behind the session", async () => {
    const ana = await seedAccount(ctx);
    const { actor } = await seedSession(ctx, ana);

    const output = await useCase.execute(actor);

    expect(output.account).toMatchObject({
      id: ana.accountId,
      name: ana.account.name,
      email: ana.email,
    });
    expect(output.membership).toStrictEqual(toOutputMembership(ana.membership));
  });

  it("throws SessionNotFound when the session does not exist", async () => {
    const ana = await seedAccount(ctx);
    const sessionId = faker.database.mongodbObjectId();

    await expectAppError(
      useCase.execute({ ...ana.actor, sessionId }),
      IdentityError.SessionNotFound,
      { sessionId },
    );
  });

  it("throws SessionNotFound when the session belongs to another account", async () => {
    const ana = await seedAccount(ctx);
    const bruno = await seedAccount(ctx);
    const { session: brunoSession } = await seedSession(ctx, bruno);

    await expectAppError(
      useCase.execute({ ...ana.actor, sessionId: brunoSession.id.value }),
      IdentityError.SessionNotFound,
      { sessionId: brunoSession.id.value },
    );
  });

  it("throws SessionRevoked when the session is revoked", async () => {
    const ana = await seedAccount(ctx);
    const { session, actor } = await seedSession(ctx, ana);
    session.revoke(SessionRevocationReason.LOGOUT, ctx.clock.now());
    await ctx.sessions.save(session);

    await expectAppError(useCase.execute(actor), IdentityError.SessionRevoked, {
      sessionId: session.id.value,
    });
  });

  it("throws SessionExpired when the session is expired", async () => {
    const ana = await seedAccount(ctx);
    const { session, actor } = await seedSession(ctx, ana, {
      ttlMs: 1_000,
    });
    ctx.clock.advance(1_000);

    await expectAppError(useCase.execute(actor), IdentityError.SessionExpired, {
      sessionId: session.id.value,
    });
  });

  it("throws AccountDeleted when the account is deleted", async () => {
    const ana = await seedAccount(ctx);
    const { actor } = await seedSession(ctx, ana);
    ana.account.markAsDeleted(ctx.clock.now());
    await ctx.accounts.save(ana.account);

    await expectAppError(useCase.execute(actor), IdentityError.AccountDeleted, {
      accountId: ana.accountId,
    });
  });

  it("throws MembershipDeleted when the membership is deleted", async () => {
    const ana = await seedAccount(ctx);
    const { actor } = await seedSession(ctx, ana);
    ana.membership.markAsDeleted(ctx.clock.now());
    await ctx.memberships.save(ana.membership);

    await expectAppError(
      useCase.execute(actor),
      IdentityError.MembershipDeleted,
      { membershipId: ana.membership.id.value },
    );
  });
});
