import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { SharedError } from "../errors/shared.error";

import {
  ModulePermissions,
  PERMISSION_MAX_LENGTH,
  PermissionCatalog,
} from "./permission-catalog.value-object";

const segment = () => faker.string.alpha({ length: 8, casing: "lower" });

const buildDeclaration = (module = segment()): ModulePermissions => ({
  module,
  permissions: faker.helpers.multiple(
    () => `${module}.${segment()}.${segment()}`,
    { count: 3 },
  ),
});

const refusal = (module: string, permission: string): Error =>
  expect.objectContaining({
    code: SharedError.InvalidPermissionCatalog.code,
    data: { module, permission },
  }) as Error;

describe("PermissionCatalog", () => {
  it("lists every code in alphabetical order", () => {
    const first = buildDeclaration();
    const second = buildDeclaration();

    const catalog = new PermissionCatalog([first, second]);

    expect(catalog.all()).toStrictEqual(
      [...first.permissions, ...second.permissions].sort(),
    );
  });

  it("lists nothing for no declaration", () => {
    expect(new PermissionCatalog([]).all()).toStrictEqual([]);
  });

  it("tells whether a code is in the catalog", () => {
    const declaration = buildDeclaration();
    const catalog = new PermissionCatalog([declaration]);

    expect(catalog.includes(declaration.permissions[0])).toBe(true);
    expect(catalog.includes(`${declaration.module}.${segment()}`)).toBe(false);
  });

  it("refuses a code declared twice", () => {
    const declaration = buildDeclaration();
    const [repeated] = declaration.permissions;

    expect(
      () =>
        new PermissionCatalog([
          declaration,
          { module: declaration.module, permissions: [repeated] },
        ]),
    ).toThrow(refusal(declaration.module, repeated));
  });

  it("refuses a code outside its module's prefix", () => {
    const module = segment();
    const permission = `${segment()}.${segment()}`;

    expect(
      () => new PermissionCatalog([{ module, permissions: [permission] }]),
    ).toThrow(refusal(module, permission));
  });

  it("refuses a code that only starts with its module's name", () => {
    const module = segment();
    const permission = `${module}${segment()}.${segment()}`;

    expect(
      () => new PermissionCatalog([{ module, permissions: [permission] }]),
    ).toThrow(refusal(module, permission));
  });

  it.each([
    ["the module alone", (module: string) => `${module}.`],
    ["an uppercase letter", (module: string) => `${module}.${segment()}A`],
    ["an empty segment", (module: string) => `${module}..${segment()}`],
    ["a hyphen", (module: string) => `${module}.${segment()}-${segment()}`],
    [
      "more than the maximum length",
      (module: string) =>
        `${module}.${faker.string.alpha({ length: PERMISSION_MAX_LENGTH, casing: "lower" })}`,
    ],
  ])("refuses a code outside the pattern: %s", (_, build) => {
    const module = segment();
    const permission = build(module);

    expect(
      () => new PermissionCatalog([{ module, permissions: [permission] }]),
    ).toThrow(refusal(module, permission));
  });

  it("accepts a code with digits, underscores and many segments up to the maximum length", () => {
    const module = segment();
    const permission = `${module}.a_1.${faker.string.alpha({
      length: PERMISSION_MAX_LENGTH - module.length - 5,
      casing: "lower",
    })}`;

    expect(
      new PermissionCatalog([{ module, permissions: [permission] }]).all(),
    ).toStrictEqual([permission]);
  });
});
