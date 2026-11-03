import { faker } from "@faker-js/faker";
import {
  PAGE_DEFAULT_LIMIT,
  PAGE_MAX_LIMIT,
} from "@shared/application/pagination.policy";
import { SharedError } from "@shared/domain/errors/shared.error";
import { expectAppError } from "@shared/testing/expect-app-error";
import { beforeEach, describe, expect, it } from "vitest";

import { toOutputAccount } from "../mappers/toOutputAccount";
import { toOutputMembership } from "../mappers/toOutputMembership";
import {
  IdentityContext,
  SeededAccount,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { ListMembersOutput } from "./list-members.types";
import { ListMembersUseCase } from "./list-members.use-case";

import { IdentityPermission } from "@/identity/domain/identity.permission";
import {
  Membership,
  MembershipRole,
} from "@/identity/domain/membership.entity";

describe("ListMembersUseCase", () => {
  let ctx: IdentityContext;
  let useCase: ListMembersUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new ListMembersUseCase(ctx);
  });

  const seedReader = () =>
    seedAccount(ctx, { permissions: [IdentityPermission.MEMBER_READ] });

  const idsOf = (output: ListMembersOutput) =>
    output.members.map((member) => member.membership.id);

  const byMembershipId = (a: SeededAccount, b: SeededAccount) =>
    a.membership.id.value.localeCompare(b.membership.id.value);

  it("lists every member with its account, deactivated ones included, in membership id order", async () => {
    const ana = await seedReader();
    const bruno = await seedAccount(ctx);
    bruno.account.markAsDeleted(ctx.clock.now());
    await ctx.accounts.save(bruno.account);

    const output = await useCase.execute(
      { limit: PAGE_DEFAULT_LIMIT },
      ana.actor,
    );

    expect(output).toStrictEqual({
      members: [ana, bruno].sort(byMembershipId).map((seeded) => ({
        account: toOutputAccount(seeded.account),
        membership: toOutputMembership(seeded.membership),
      })),
      nextCursor: null,
    });
  });

  it("pages with the limit and continues from the cursor", async () => {
    const ana = await seedReader();
    const bruno = await seedAccount(ctx);
    const carla = await seedAccount(ctx);
    const ordered = [ana, bruno, carla]
      .sort(byMembershipId)
      .map((seeded) => seeded.membership.id.value);

    const first = await useCase.execute({ limit: 2 }, ana.actor);
    const second = await useCase.execute(
      { cursor: ordered[1], limit: 2 },
      ana.actor,
    );

    expect(first).toMatchObject({ nextCursor: ordered[1] });
    expect(idsOf(first)).toStrictEqual(ordered.slice(0, 2));
    expect(second).toMatchObject({ nextCursor: null });
    expect(idsOf(second)).toStrictEqual(ordered.slice(2));
  });

  it("skips removed memberships and memberships without an account", async () => {
    const ana = await seedReader();
    const removed = await seedAccount(ctx);
    removed.membership.markAsDeleted(ctx.clock.now());
    await ctx.memberships.save(removed.membership);
    const orphanAccountId = faker.database.mongodbObjectId();
    await ctx.memberships.save(
      Membership.register(
        {
          id: faker.database.mongodbObjectId(),
          accountId: orphanAccountId,
          createdBy: orphanAccountId,
          role: MembershipRole.USER,
          permissions: [],
        },
        ctx.clock.now(),
      ),
    );

    const output = await useCase.execute({ limit: PAGE_MAX_LIMIT }, ana.actor);

    expect(idsOf(output)).toStrictEqual([ana.membership.id.value]);
  });

  it("refuses permission_missing without member.read, even with the admin role", async () => {
    const ana = await seedAccount(ctx, {
      role: MembershipRole.ADMIN,
      permissions: Object.values(IdentityPermission).filter(
        (permission) => permission !== IdentityPermission.MEMBER_READ,
      ),
    });

    await expectAppError(
      useCase.execute({ limit: PAGE_DEFAULT_LIMIT }, ana.actor),
      SharedError.PermissionMissing,
      { required: IdentityPermission.MEMBER_READ },
    );
  });
});
