import { describe, expect, it } from "vitest";

import { formatValidCpfOrCnpj } from ".";

describe("formatValidCpfOrCnpj", () => {
  it("returns the formatted cpf when it is valid", () => {
    const result = formatValidCpfOrCnpj("77388332707");
    expect(result).toBe("773.883.327-07");
  });

  it("returns null when the input is missing", () => {
    const result = formatValidCpfOrCnpj(null);
    expect(result).toBeNull();
  });

  it("returns the formatted cnpj when it is valid", () => {
    const result = formatValidCpfOrCnpj("KQGLDO7R000138");
    expect(result).toBe("KQ.GLD.O7R/0001-38");
  });
});
