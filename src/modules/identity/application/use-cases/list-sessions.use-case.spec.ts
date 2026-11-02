import { beforeEach, describe, expect, it } from "vitest";

import { toOutputSession } from "../mappers/toOutputSession";
import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";

import { ListSessionsUseCase } from "./list-sessions.use-case";

import { SessionRevocationReason } from "@/identity/domain/session.entity";

describe("ListSessionsUseCase", () => {
  let ctx: IdentityContext;
  let useCase: ListSessionsUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new ListSessionsUseCase(ctx);
  });

  it("lists only active sessions of the account, newest first", async () => {
    const ana = await seedAccount(ctx);
    const { session: older } = await seedSession(ctx, ana);
    await seedSession(ctx, ana, { ttlMs: 1_000 }); // will be expired
    const { session: loggedOut } = await seedSession(ctx, ana);
    loggedOut.revoke(SessionRevocationReason.LOGOUT, ctx.clock.now());
    await ctx.sessions.save(loggedOut);
    ctx.clock.advance(2_000);
    const { session: newer } = await seedSession(ctx, ana);
    const bruno = await seedAccount(ctx);
    await seedSession(ctx, bruno);

    const output = await useCase.execute(ana.actor);

    expect(output.sessions.map((session) => session.id)).toEqual([
      newer.id.value,
      older.id.value,
    ]);
  });

  it("does not expose the token hash", async () => {
    const ana = await seedAccount(ctx);
    const { session } = await seedSession(ctx, ana);

    const output = await useCase.execute(ana.actor);

    expect(output.sessions).toStrictEqual([
      { ...toOutputSession(session), current: false },
    ]);
    expect(output.sessions[0]).not.toHaveProperty("tokenHash");
  });

  it("marks the session of the caller as the current one", async () => {
    const ana = await seedAccount(ctx);
    const { session: other } = await seedSession(ctx, ana);
    const { session: mine, actor } = await seedSession(ctx, ana);

    const output = await useCase.execute(actor);

    expect(
      output.sessions.map((session) => [session.id, session.current]),
    ).toEqual(
      expect.arrayContaining([
        [mine.id.value, true],
        [other.id.value, false],
      ]),
    );
  });

  it("returns an empty list when the account has no sessions", async () => {
    const ana = await seedAccount(ctx);

    const output = await useCase.execute(ana.actor);

    expect(output.sessions).toEqual([]);
  });
});
