import { Access } from "@shared/application/use-cases";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
} from "../testing/identity-context";

import { ListPermissionsUseCase } from "./list-permissions.use-case";

import { IdentityPermission } from "@/identity/domain/identity.permission";

describe("ListPermissionsUseCase", () => {
  let ctx: IdentityContext;
  let useCase: ListPermissionsUseCase;

  beforeEach(() => {
    ctx = createIdentityContext();
    useCase = new ListPermissionsUseCase(ctx);
  });

  it("is open to any member", () => {
    expect(useCase.access).toBe(Access.MEMBER);
  });

  it("returns every catalog code in alphabetical order", async () => {
    const ana = await seedAccount(ctx);

    const output = await useCase.execute(ana.actor);

    expect(output).toStrictEqual({
      permissions: [
        ...Object.values(IdentityPermission),
        ...ctx.otherModulePermissions.permissions,
      ].sort(),
    });
  });
});
