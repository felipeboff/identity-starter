import { describe, expect, it } from "vitest";

import * as schemas from "./index";

describe("schemas index", () => {
  it.each([
    "array",
    "bigint",
    "boolean",
    "cnpj",
    "cpf",
    "cpfCnpj",
    "date",
    "email",
    "enumValue",
    "number",
    "object",
    "objectId",
    "record",
    "string",
    "url",
    "uuid",
  ] as const)("re-exports %s", (name) => {
    expect(schemas[name]).toEqual(expect.any(Function));
  });
});
