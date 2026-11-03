import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";

import { ListAccountSessionsUseCase } from "./list-account-sessions.use-case";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { IdentityPermission } from "@/identity/domain/identity.permission";
import { MembershipRole } from "@/identity/domain/membership.entity";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

describe("ListAccountSessionsUseCase", () => {
  let ctx: IdentityContext;
  let useCase: ListAccountSessionsUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new ListAccountSessionsUseCase(ctx);
  });

  it("lists another account's active sessions, newest first, to a holder of session.read", async () => {
    const admin = await seedAccount(ctx, {
      permissions: [IdentityPermission.SESSION_READ],
    });
    const bob = await seedAccount(ctx);
    const { session: older } = await seedSession(ctx, bob);
    const { session: loggedOut } = await seedSession(ctx, bob);
    loggedOut.revoke(SessionRevocationReason.LOGOUT, ctx.clock.now());
    await ctx.sessions.save(loggedOut);
    ctx.clock.advance(1_000);
    const { session: newer } = await seedSession(ctx, bob);

    const output = await useCase.execute(
      { accountId: bob.accountId },
      admin.actor,
    );

    expect(
      output.sessions.map((session) => [session.id, session.current]),
    ).toEqual([
      [newer.id.value, false],
      [older.id.value, false],
    ]);
  });

  it("lets the owner list their own sessions without the permission, marking the current one", async () => {
    const ana = await seedAccount(ctx);
    const { session, actor } = await seedSession(ctx, ana);

    const output = await useCase.execute({ accountId: ana.accountId }, actor);

    expect(output.sessions).toEqual([
      expect.objectContaining({ id: session.id.value, current: true }),
    ]);
  });

  it("throws Forbidden on someone else's account without session.read, even with the admin role", async () => {
    const ana = await seedAccount(ctx, {
      role: MembershipRole.ADMIN,
      permissions: Object.values(IdentityPermission).filter(
        (permission) => permission !== IdentityPermission.SESSION_READ,
      ),
    });
    const bob = await seedAccount(ctx);

    await expectAppError(
      useCase.execute({ accountId: bob.accountId }, ana.actor),
      IdentityError.Forbidden,
      { actorAccountId: ana.accountId },
    );
  });
});
