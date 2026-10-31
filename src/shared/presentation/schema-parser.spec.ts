import { faker } from "@faker-js/faker";
import Type from "typebox";
import { describe, expect, it } from "vitest";

import { defineError } from "../domain/errors/app-error";
import type { InputInvalidData } from "../domain/errors/input-invalid-data";
import { SharedError } from "../domain/errors/shared.error";

import { SchemaParser } from "./schema-parser";

const signUpSchema = Type.Object({
  name: Type.String(),
  email: Type.String({ format: "email" }),
  password: Type.String({ minLength: 12 }),
});

type SignUp = Type.Static<typeof signUpSchema>;

const buildSignUp = (overrides: Partial<SignUp> = {}): SignUp => ({
  name: faker.person.fullName(),
  email: faker.internet.email(),
  password: faker.string.alphanumeric(16),
  ...overrides,
});

const shortPassword = () =>
  faker.string.alphanumeric({ length: { min: 1, max: 11 } });

describe("SchemaParser", () => {
  const parser = new SchemaParser();

  it("returns the data of a valid input", () => {
    const input = buildSignUp();

    expect(parser.safeParse(signUpSchema, input)).toStrictEqual({
      ok: true,
      data: input,
    });
  });

  it("returns the violations of an invalid input without throwing", () => {
    const input = buildSignUp({ password: shortPassword() });

    expect(parser.safeParse(signUpSchema, input)).toStrictEqual({
      ok: false,
      violations: [{ field: "password", reason: "minLength" }],
    });
  });

  it("leaves the raw input untouched", () => {
    const input = {
      ...buildSignUp(),
      [faker.string.alpha(12)]: faker.lorem.word(),
    };
    const copy = structuredClone(input);

    parser.safeParse(signUpSchema, input);

    expect(input).toStrictEqual(copy);
  });

  describe("names the keyword that failed", () => {
    it("names minLength for a short password", () => {
      const input = buildSignUp({ password: shortPassword() });

      expect(parser.safeParse(signUpSchema, input)).toStrictEqual({
        ok: false,
        violations: [{ field: "password", reason: "minLength" }],
      });
    });

    it("names format for a malformed e-mail", () => {
      const input = buildSignUp({ email: faker.lorem.word() });

      expect(parser.safeParse(signUpSchema, input)).toStrictEqual({
        ok: false,
        violations: [{ field: "email", reason: "format" }],
      });
    });

    it("names enum for an unknown value", () => {
      const roleSchema = Type.Object({ role: Type.Enum(["admin", "member"]) });

      expect(
        parser.safeParse(roleSchema, { role: faker.string.alpha(12) }),
      ).toStrictEqual({
        ok: false,
        violations: [{ field: "role", reason: "enum" }],
      });
    });
  });

  it("reports each missing property as required, in schema order", () => {
    const itemsSchema = Type.Object({
      items: Type.Array(Type.Object({ name: Type.String() })),
    });

    expect(
      parser.safeParse(signUpSchema, {
        password: faker.string.alphanumeric(16),
      }),
    ).toStrictEqual({
      ok: false,
      violations: [
        { field: "name", reason: "required" },
        { field: "email", reason: "required" },
      ],
    });
    expect(parser.safeParse(itemsSchema, { items: [{}] })).toStrictEqual({
      ok: false,
      violations: [{ field: "items.0.name", reason: "required" }],
    });
  });

  it("writes the field as a dotted path", () => {
    const itemsSchema = Type.Object({
      items: Type.Array(Type.Object({ name: Type.String({ minLength: 2 }) })),
    });
    const input = {
      items: [{ name: faker.string.alpha(3) }, { name: faker.string.alpha(1) }],
    };

    expect(parser.safeParse(itemsSchema, input)).toStrictEqual({
      ok: false,
      violations: [{ field: "items.1.name", reason: "minLength" }],
    });
  });

  it("unescapes a property name that holds a slash or a tilde", () => {
    const key = `${faker.string.alpha(3)}/${faker.string.alpha(3)}~`;
    const schema = Type.Object({ [key]: Type.String() });

    expect(parser.safeParse(schema, {})).toStrictEqual({
      ok: false,
      violations: [{ field: key, reason: "required" }],
    });
  });

  it("uses an empty field at the root", () => {
    expect(parser.safeParse(signUpSchema, faker.lorem.word())).toStrictEqual({
      ok: false,
      violations: [{ field: "", reason: "type" }],
    });
  });

  it("reports each field and reason once", () => {
    const codeSchema = Type.Object({
      code: Type.Union([
        Type.String({ minLength: 4 }),
        Type.String({ minLength: 8 }),
      ]),
    });

    expect(
      parser.safeParse(codeSchema, { code: faker.string.alpha(2) }),
    ).toStrictEqual({
      ok: false,
      violations: [
        { field: "code", reason: "minLength" },
        { field: "code", reason: "anyOf" },
      ],
    });
  });

  it("throws shared.input_invalid with the violations", () => {
    const input = buildSignUp({ password: shortPassword() });

    expect(() => parser.parse(signUpSchema, input)).toThrow(
      expect.objectContaining({
        code: SharedError.InputInvalid.code,
        data: { violations: [{ field: "password", reason: "minLength" }] },
      }),
    );
  });

  it("throws the error definition it receives", () => {
    const Refused = defineError<InputInvalidData>(
      `${faker.lorem.word()}.${faker.lorem.word()}`,
      "invalid_input",
    );

    expect(() => parser.parse(signUpSchema, {}, Refused)).toThrow(
      expect.objectContaining({
        code: Refused.code,
        data: {
          violations: [
            { field: "name", reason: "required" },
            { field: "email", reason: "required" },
            { field: "password", reason: "required" },
          ],
        },
      }),
    );
  });

  it("returns the decoded data from parse", () => {
    const address = faker.internet.url();
    const siteSchema = Type.Object({
      site: Type.Codec(Type.String({ format: "url" }))
        .Decode((value) => new URL(value))
        .Encode((url) => url.href),
    });

    const parsed = parser.parse(siteSchema, { site: address });

    expect(parsed.site).toStrictEqual(new URL(address));
  });
});
