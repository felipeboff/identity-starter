import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";

import { SignOutUseCase } from "./sign-out.use-case";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

describe("SignOutUseCase", () => {
  let ctx: IdentityContext;
  let useCase: SignOutUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new SignOutUseCase(ctx);
  });

  it("revokes the session as LOGOUT", async () => {
    const ana = await seedAccount(ctx);
    const { session, actor } = await seedSession(ctx, ana);

    await useCase.execute(actor);

    const stored = await ctx.sessions.findById(session.id.value);
    expect(stored?.revokedReason).toBe(SessionRevocationReason.LOGOUT);
    expect(stored?.revokedAt).toEqual(ctx.clock.now());
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
});
