import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";

import { RevokeOtherSessionsUseCase } from "./revoke-other-sessions.use-case";

import { SessionRevocationReason } from "@/identity/domain/session.entity";

describe("RevokeOtherSessionsUseCase", () => {
  let ctx: IdentityContext;
  let useCase: RevokeOtherSessionsUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new RevokeOtherSessionsUseCase(ctx);
  });

  it("revokes every other session of the account and keeps the caller's", async () => {
    const ana = await seedAccount(ctx);
    const { session: laptop } = await seedSession(ctx, ana);
    const { session: tablet } = await seedSession(ctx, ana);
    const { session: phone, actor } = await seedSession(ctx, ana);
    const bruno = await seedAccount(ctx);
    const { session: someoneElse } = await seedSession(ctx, bruno);

    const output = await useCase.execute(actor);

    const now = ctx.clock.now();
    expect(output).toStrictEqual({ revokedCount: 2 });
    for (const revoked of [laptop, tablet]) {
      expect(
        (await ctx.sessions.findById(revoked.id.value))?.toSnapshot(),
      ).toMatchObject({
        revokedReason: SessionRevocationReason.SECURITY,
        revokedAt: now,
        acceptedByAccountId: ana.accountId,
      });
    }
    expect((await ctx.sessions.findById(phone.id.value))?.isActive(now)).toBe(
      true,
    );
    expect(
      (await ctx.sessions.findById(someoneElse.id.value))?.isActive(now),
    ).toBe(true);
  });

  it("revokes nothing when the caller has no other session", async () => {
    const ana = await seedAccount(ctx);
    const { actor } = await seedSession(ctx, ana);

    const output = await useCase.execute(actor);

    expect(output).toStrictEqual({ revokedCount: 0 });
  });

  it("writes nothing when the last write fails", async () => {
    const ana = await seedAccount(ctx);
    const { session: first } = await seedSession(ctx, ana);
    await seedSession(ctx, ana);
    const { actor } = await seedSession(ctx, ana);
    const failure = new Error(faker.lorem.sentence());
    const save = ctx.sessions.save.bind(ctx.sessions);
    vi.spyOn(ctx.sessions, "save")
      .mockImplementationOnce(save)
      .mockRejectedValueOnce(failure);

    await expect(useCase.execute(actor)).rejects.toBe(failure);

    expect(
      (await ctx.sessions.findById(first.id.value))?.isActive(ctx.clock.now()),
    ).toBe(true);
  });
});
