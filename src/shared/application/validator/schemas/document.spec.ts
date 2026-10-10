import { faker } from "@faker-js/faker";
import { assert, describe, expect, it } from "vitest";

import { cnpj, cpf, cpfCnpj } from "./document";

const VALID_CPF = "773.883.327-07";
const VALID_CNPJ = "KQ.GLD.O7R/0001-38";

describe("cpf", () => {
  it("returns the formatted cpf when it is valid", () => {
    const parsed = cpf().parse("77388332707");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(VALID_CPF);
  });

  it("finishes with a required violation when the input is missing", () => {
    expect(cpf().parse(undefined)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "required" }],
    });
  });

  it("finishes with undefined when the input is optional and missing", () => {
    const parsed = cpf({ optional: true }).parse(undefined);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeUndefined();
  });

  it("finishes with null when the input is nullable", () => {
    const parsed = cpf({ nullable: true }).parse(null);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBeNull();
  });

  it("returns an invalid_cpf violation when the input is not a string", () => {
    expect(cpf().parse(10)).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_cpf" }],
    });
  });

  it("returns an invalid_cpf violation when the document is invalid", () => {
    expect(cpf().parse("00000000000")).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_cpf" }],
    });
  });

  it("allows an empty string when empty is enabled", () => {
    const parsed = cpf({ empty: true }).parse("   ");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe("");
  });

  it("applies transform to the formatted document", () => {
    const parsed = cpf({
      transform: (value) => value.replaceAll(".", ""),
    }).parse(VALID_CPF);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe("773883327-07");
  });

  it("returns refine violations after a successful parse", () => {
    const reason = faker.lorem.word();

    expect(
      cpf({ refine: [{ check: () => false, reason }] }).parse(VALID_CPF),
    ).toEqual({
      ok: false,
      violations: [{ field: "", reason }],
    });
  });
});

describe("cnpj", () => {
  it("returns the formatted cnpj when it is valid", () => {
    const parsed = cnpj().parse("KQGLDO7R000138");

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(VALID_CNPJ);
  });

  it("returns an invalid_cnpj violation when the document is invalid", () => {
    expect(cnpj().parse("00000000000000")).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_cnpj" }],
    });
  });
});

describe("cpfCnpj", () => {
  it("returns the formatted cpf when the input is a cpf", () => {
    const parsed = cpfCnpj().parse(VALID_CPF);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(VALID_CPF);
  });

  it("returns the formatted cnpj when the input is a cnpj", () => {
    const parsed = cpfCnpj().parse(VALID_CNPJ);

    expect(parsed.ok).toBe(true);
    assert(parsed.ok === true);
    expect(parsed.data).toBe(VALID_CNPJ);
  });

  it("returns an invalid_cpf_cnpj violation when the document is invalid", () => {
    expect(cpfCnpj().parse("invalid")).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_cpf_cnpj" }],
    });
  });
});
