import { faker } from "@faker-js/faker";
import { LogLevel } from "@shared/application/ports/logger";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toOutputAccount } from "../mappers/toOutputAccount";
import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "../testing/identity-context";
import { IdentityUseCaseLogEvent } from "../use-case.log-event";

import { RefreshSessionUseCase } from "./refresh-session.use-case";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

describe("RefreshSessionUseCase", () => {
  let ctx: IdentityContext;
  let useCase: RefreshSessionUseCase;

  const makeDevice = () => ({
    userAgent: faker.internet.userAgent(),
    ipAddress: faker.internet.ip(),
  });

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new RefreshSessionUseCase(ctx);
  });

  it("rotates the refresh token and replaces the session", async () => {
    const ana = await seedAccount(ctx);
    const { session: previous, refreshToken } = await seedSession(ctx, ana);
    const device = makeDevice();

    const output = await useCase.execute({ refreshToken, ...device });

    const now = ctx.clock.now();
    expect(output.refreshToken).not.toBe(refreshToken);
    expect(output.account.lastSeenAt).toEqual(now);
    const account = await ctx.accounts.findById(ana.accountId);
    expect(account?.lastSeenAt).toEqual(now);

    const old = await ctx.sessions.findById(previous.id.value);
    expect(old?.toSnapshot()).toMatchObject({
      revokedReason: SessionRevocationReason.REPLACED,
      revokedAt: now,
      acceptedByAccountId: ana.accountId,
    });

    const next = await ctx.sessions.findByTokenHash(
      ctx.tokens.hash(output.refreshToken),
    );
    expect(next?.toSnapshot()).toMatchObject({
      accountId: ana.accountId,
      credentialId: ana.credential.id.value,
      membershipId: ana.membership.id.value,
      userAgent: device.userAgent,
      ipAddress: device.ipAddress,
      revokedAt: null,
    });
    expect(output.accessToken).toBe(
      `access:${ana.accountId}:${next?.id.value}`,
    );
  });

  it("throws InvalidRefreshToken when the token is unknown", async () => {
    await expectAppError(
      useCase.execute({
        refreshToken: faker.string.alphanumeric(32),
        ...makeDevice(),
      }),
      IdentityError.InvalidRefreshToken,
    );
  });

  it("throws SessionRevoked when the session is revoked", async () => {
    const ana = await seedAccount(ctx);
    const { session, refreshToken } = await seedSession(ctx, ana);
    session.revoke(SessionRevocationReason.LOGOUT, ctx.clock.now());
    await ctx.sessions.save(session);

    await expectAppError(
      useCase.execute({ refreshToken, ...makeDevice() }),
      IdentityError.SessionRevoked,
      { sessionId: session.id.value },
    );
  });

  it("throws SessionExpired when the session is expired", async () => {
    const ana = await seedAccount(ctx);
    const { session, refreshToken } = await seedSession(ctx, ana, {
      ttlMs: 1_000,
    });
    ctx.clock.advance(1_000);

    await expectAppError(
      useCase.execute({ refreshToken, ...makeDevice() }),
      IdentityError.SessionExpired,
      { sessionId: session.id.value },
    );
  });

  it("throws AccountNotFound when the account does not exist", async () => {
    const ana = await seedAccount(ctx);
    const { refreshToken } = await seedSession(ctx, ana);
    // Repositories have no delete: simulate an entity that is gone.
    vi.spyOn(ctx.accounts, "findById").mockResolvedValue(null);

    await expectAppError(
      useCase.execute({ refreshToken, ...makeDevice() }),
      IdentityError.AccountNotFound,
      { accountId: ana.accountId },
    );
  });

  it("throws AccountDeleted when the account is deleted", async () => {
    const ana = await seedAccount(ctx);
    const { refreshToken } = await seedSession(ctx, ana);
    ana.account.markAsDeleted(ctx.clock.now());
    await ctx.accounts.save(ana.account);

    await expectAppError(
      useCase.execute({ refreshToken, ...makeDevice() }),
      IdentityError.AccountDeleted,
      { accountId: ana.accountId },
    );
  });

  it("throws CredentialNotFound when the session credential does not exist", async () => {
    const ana = await seedAccount(ctx);
    const credentialId = faker.database.mongodbObjectId();
    const { refreshToken } = await seedSession(ctx, ana, { credentialId });

    await expectAppError(
      useCase.execute({ refreshToken, ...makeDevice() }),
      IdentityError.CredentialNotFound,
      { credentialId },
    );
  });

  it("throws CredentialDeleted when the credential is deleted", async () => {
    const ana = await seedAccount(ctx);
    const { refreshToken } = await seedSession(ctx, ana);
    ana.credential.markAsDeleted(ctx.clock.now());
    await ctx.credentials.save(ana.credential);

    await expectAppError(
      useCase.execute({ refreshToken, ...makeDevice() }),
      IdentityError.CredentialDeleted,
      { credentialId: ana.credential.id.value },
    );
  });

  it("throws MembershipNotFound when the membership does not exist", async () => {
    const ana = await seedAccount(ctx);
    const { refreshToken } = await seedSession(ctx, ana);
    // Repositories have no delete: simulate an entity that is gone.
    vi.spyOn(ctx.memberships, "findById").mockResolvedValue(null);

    await expectAppError(
      useCase.execute({ refreshToken, ...makeDevice() }),
      IdentityError.MembershipNotFound,
      { accountId: ana.accountId },
    );
  });

  it("throws MembershipDeleted when the membership is deleted", async () => {
    const ana = await seedAccount(ctx);
    const { refreshToken } = await seedSession(ctx, ana);
    ana.membership.markAsDeleted(ctx.clock.now());
    await ctx.memberships.save(ana.membership);

    await expectAppError(
      useCase.execute({ refreshToken, ...makeDevice() }),
      IdentityError.MembershipDeleted,
      { membershipId: ana.membership.id.value },
    );
  });

  it("writes nothing when the last write fails", async () => {
    const ana = await seedAccount(ctx);
    const { session, refreshToken } = await seedSession(ctx, ana);
    const failure = new Error(faker.lorem.sentence());
    const save = ctx.sessions.save.bind(ctx.sessions);
    vi.spyOn(ctx.sessions, "save")
      .mockImplementationOnce(save)
      .mockRejectedValueOnce(failure);

    await expect(
      useCase.execute({ refreshToken, ...makeDevice() }),
    ).rejects.toBe(failure);

    expect((await ctx.accounts.findById(ana.accountId))?.lastSeenAt).toBeNull();
    expect((await ctx.sessions.findById(session.id.value))?.isRevoked()).toBe(
      false,
    );
  });

  it("returns the account as it was stored", async () => {
    const ana = await seedAccount(ctx);
    const { refreshToken } = await seedSession(ctx, ana);

    const output = await useCase.execute({ refreshToken, ...makeDevice() });

    const stored = await ctx.accounts.findById(ana.accountId);
    expect(stored && toOutputAccount(stored)).toStrictEqual(output.account);
  });

  it("revokes every session of the account and refuses a rotated token used again", async () => {
    const ana = await seedAccount(ctx);
    const { session, refreshToken } = await seedSession(ctx, ana);
    const rotated = await useCase.execute({ refreshToken, ...makeDevice() });

    await expectAppError(
      useCase.execute({ refreshToken, ...makeDevice() }),
      IdentityError.RefreshTokenReused,
    );

    const next = await ctx.sessions.findByTokenHash(
      ctx.tokens.hash(rotated.refreshToken),
    );
    expect(next?.revokedReason).toBe(SessionRevocationReason.SECURITY);
    expect(ctx.logger.entries).toStrictEqual([
      {
        level: LogLevel.INFO,
        event: IdentityUseCaseLogEvent.SessionsRevoked.name,
        fields: {
          accountId: ana.accountId,
          reason: SessionRevocationReason.SECURITY,
          revokedBy: null,
          sessionIds: [next?.id.value],
        },
      },
      {
        level: LogLevel.WARN,
        event: IdentityUseCaseLogEvent.RefreshTokenReused.name,
        fields: {
          accountId: ana.accountId,
          sessionId: session.id.value,
          revokedSessions: 1,
        },
      },
    ]);
  });
});
