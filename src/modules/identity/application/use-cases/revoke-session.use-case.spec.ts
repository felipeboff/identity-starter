import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";

import { RevokeSessionUseCase } from "./revoke-session.use-case";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { MembershipRole } from "@/identity/domain/membership.entity";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

describe("RevokeSessionUseCase", () => {
  let ctx: IdentityContext;
  let useCase: RevokeSessionUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new RevokeSessionUseCase(ctx);
  });

  it("lets the owner revoke their own session as SECURITY", async () => {
    const ana = await seedAccount(ctx);
    const { session } = await seedSession(ctx, ana);

    await useCase.execute({ sessionId: session.id.value }, ana.actor);

    const stored = await ctx.sessions.findById(session.id.value);
    expect(stored?.toSnapshot()).toMatchObject({
      revokedReason: SessionRevocationReason.SECURITY,
      revokedAt: ctx.clock.now(),
      acceptedByAccountId: ana.accountId,
    });
  });

  it("lets an admin revoke someone else's session", async () => {
    const admin = await seedAccount(ctx, { role: MembershipRole.ADMIN });
    const ana = await seedAccount(ctx);
    const { session } = await seedSession(ctx, ana);

    await useCase.execute({ sessionId: session.id.value }, admin.actor);

    const stored = await ctx.sessions.findById(session.id.value);
    expect(stored?.toSnapshot()).toMatchObject({
      revokedReason: SessionRevocationReason.SECURITY,
      acceptedByAccountId: admin.accountId,
    });
  });

  it("throws Forbidden when a regular user revokes someone else's session", async () => {
    const bruno = await seedAccount(ctx);
    const ana = await seedAccount(ctx);
    const { session } = await seedSession(ctx, ana);

    await expectAppError(
      useCase.execute({ sessionId: session.id.value }, bruno.actor),
      IdentityError.Forbidden,
      { actorAccountId: bruno.accountId },
    );

    const stored = await ctx.sessions.findById(session.id.value);
    expect(stored?.isRevoked()).toBe(false);
  });

  it("throws SessionNotFound when the session does not exist", async () => {
    const ana = await seedAccount(ctx);
    const sessionId = faker.database.mongodbObjectId();

    await expectAppError(
      useCase.execute({ sessionId }, ana.actor),
      IdentityError.SessionNotFound,
      { sessionId },
    );
  });
});
