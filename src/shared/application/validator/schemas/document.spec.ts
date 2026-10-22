import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { cnpj, cpf, cpfCnpj } from "./document";

const ok = (data: unknown) => ({ ok: true, data });
const fail = (reason: string) => ({
  ok: false,
  violations: [{ field: "", reason }],
});

const CPF = "773.883.327-07";
const CNPJ = "KQ.GLD.O7R/0001-38";

describe("cpf", () => {
  it("formats a valid cpf", () => {
    expect(cpf().parse("77388332707")).toEqual(ok(CPF));
  });

  it.each([
    ["a number", faker.number.int()],
    ["an invalid cpf", "00000000000"],
  ])("rejects %s as invalid_cpf", (_, input) => {
    expect(cpf().parse(input)).toEqual(fail("invalid_cpf"));
  });

  describe("missing values", () => {
    it("requires a value by default", () => {
      expect(cpf().parse(undefined)).toEqual(fail("required"));
    });

    it("accepts undefined when optional", () => {
      expect(cpf({ optional: true }).parse(undefined)).toEqual(ok(undefined));
    });

    it("accepts null when nullable", () => {
      expect(cpf({ nullable: true }).parse(null)).toEqual(ok(null));
    });

    it("accepts a blank string as empty when empty is enabled", () => {
      expect(cpf({ empty: true }).parse("   ")).toEqual(ok(""));
    });
  });

  it("applies transform to the formatted document", () => {
    const schema = cpf({ transform: (value) => value.replaceAll(".", "") });

    expect(schema.parse(CPF)).toEqual(ok("773883327-07"));
  });

  it("reports refine violations after a successful parse", () => {
    const reason = faker.lorem.slug();
    const schema = cpf({ refine: [{ check: () => false, reason }] });

    expect(schema.parse(CPF)).toEqual(fail(reason));
  });
});

describe("cnpj", () => {
  it("formats a valid cnpj", () => {
    expect(cnpj().parse("KQGLDO7R000138")).toEqual(ok(CNPJ));
  });

  it("rejects an invalid cnpj as invalid_cnpj", () => {
    expect(cnpj().parse("00000000000000")).toEqual(fail("invalid_cnpj"));
  });
});

describe("cpfCnpj", () => {
  it.each([
    ["a cpf", CPF],
    ["a cnpj", CNPJ],
  ])("accepts %s", (_, input) => {
    expect(cpfCnpj().parse(input)).toEqual(ok(input));
  });

  it("rejects an invalid document as invalid_cpf_cnpj", () => {
    expect(cpfCnpj().parse(faker.lorem.word())).toEqual(
      fail("invalid_cpf_cnpj"),
    );
  });
});
