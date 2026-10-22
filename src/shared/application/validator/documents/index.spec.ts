import { describe, expect, it } from "vitest";

import { formatValidCpfOrCnpj } from ".";

describe("formatValidCpfOrCnpj", () => {
  it.each([
    ["a cpf", "77388332707", "773.883.327-07"],
    ["a cnpj", "KQGLDO7R000138", "KQ.GLD.O7R/0001-38"],
    ["a missing value", null, null],
    ["an invalid document", "12345", null],
  ])("handles %s", (_, input, expected) => {
    expect(formatValidCpfOrCnpj(input)).toBe(expected);
  });
});
