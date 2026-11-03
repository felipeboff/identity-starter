import { faker } from "@faker-js/faker";
import { LogLevel } from "@shared/application/ports/logger";
import { SharedError } from "@shared/domain/errors/shared.error";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";
import { IdentityUseCaseLogEvent } from "../use-case.log-event";

import { GrantAdminUseCase } from "./grant-admin.use-case";

import { IdentityError } from "@/identity/domain/errors/identity.error";
import { IdentityPermission } from "@/identity/domain/identity.permission";
import { MembershipRole } from "@/identity/domain/membership.entity";

describe("GrantAdminUseCase", () => {
  let ctx: IdentityContext;
  let useCase: GrantAdminUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new GrantAdminUseCase(ctx);
  });

  const everyCode = () =>
    [
      ...Object.values(IdentityPermission),
      ...ctx.otherModulePermissions.permissions,
    ].sort();

  it("grants exactly every code in the catalog, another module's included, with the admin role", async () => {
    const ana = await seedAccount(ctx);

    const output = await useCase.execute({ email: ana.email });

    const stored = await ctx.memberships.findByAccountId(ana.accountId);
    expect(stored?.role).toBe(MembershipRole.ADMIN);
    expect(stored?.permissions).toStrictEqual(everyCode());
    expect(stored?.updatedAt).toEqual(ctx.clock.now());
    expect(output.membership).toMatchObject({
      accountId: ana.accountId,
      role: MembershipRole.ADMIN,
      permissions: everyCode(),
    });
  });

  it("finds the account whatever the letter case and spaces of the e-mail", async () => {
    const ana = await seedAccount(ctx);

    await useCase.execute({ email: `  ${ana.email.toUpperCase()}  ` });

    const stored = await ctx.memberships.findByAccountId(ana.accountId);
    expect(stored?.permissions).toStrictEqual(everyCode());
  });

  it("ends in the same state when run twice", async () => {
    const ana = await seedAccount(ctx, {
      permissions: [IdentityPermission.MEMBER_READ],
    });

    await useCase.execute({ email: ana.email });
    await useCase.execute({ email: ana.email });

    const stored = await ctx.memberships.findByAccountId(ana.accountId);
    expect(stored?.role).toBe(MembershipRole.ADMIN);
    expect(stored?.permissions).toStrictEqual(everyCode());
  });

  it("throws EmailRequired when no e-mail is given", async () => {
    await expectAppError(
      useCase.execute({ email: "" }),
      SharedError.EmailRequired,
    );
  });

  it("throws AccountNotFound for an e-mail with no account", async () => {
    const email = faker.internet.email().toLowerCase();

    await expectAppError(
      useCase.execute({ email }),
      IdentityError.AccountNotFound,
      { email },
    );
  });

  it("throws AccountDeleted for a deactivated account", async () => {
    const ana = await seedAccount(ctx);
    ana.account.markAsDeleted(ctx.clock.now());
    await ctx.accounts.save(ana.account);

    await expectAppError(
      useCase.execute({ email: ana.email }),
      IdentityError.AccountDeleted,
      { accountId: ana.accountId },
    );
  });

  it("throws MembershipDeleted for a removed membership", async () => {
    const ana = await seedAccount(ctx);
    ana.membership.markAsDeleted(ctx.clock.now());
    await ctx.memberships.save(ana.membership);

    await expectAppError(
      useCase.execute({ email: ana.email }),
      IdentityError.MembershipDeleted,
      { membershipId: ana.membership.id.value },
    );
  });

  describe("log", () => {
    it("logs identity.admin_granted with the account and the membership", async () => {
      const ana = await seedAccount(ctx);

      await useCase.execute({ email: ana.email });

      expect(ctx.logger.entries).toStrictEqual([
        {
          level: LogLevel.INFO,
          event: IdentityUseCaseLogEvent.AdminGranted.name,
          fields: {
            accountId: ana.accountId,
            membershipId: ana.membership.id.value,
          },
        },
      ]);
    });

    it("logs identity.admin_grant_failed with the e-mail and the error code as reason", async () => {
      const email = faker.internet.email().toLowerCase();

      await useCase.execute({ email }).catch(() => undefined);

      expect(ctx.logger.entries).toStrictEqual([
        {
          level: LogLevel.WARN,
          event: IdentityUseCaseLogEvent.AdminGrantFailed.name,
          fields: { email, reason: IdentityError.AccountNotFound.code },
        },
      ]);
    });

    it("does not log an unexpected failure as a failed grant", async () => {
      const ana = await seedAccount(ctx);
      const failure = new Error(faker.lorem.sentence());
      vi.spyOn(ctx.memberships, "save").mockRejectedValueOnce(failure);

      await expect(useCase.execute({ email: ana.email })).rejects.toBe(failure);

      expect(ctx.logger.entries).toStrictEqual([]);
    });
  });
});
