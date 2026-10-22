import { describe, expect, it } from "vitest";

import {
  array,
  bigint,
  boolean,
  cnpj,
  cpf,
  cpfCnpj,
  date,
  email,
  enumValue,
  formatValidCnpj,
  formatValidCpf,
  formatValidCpfOrCnpj,
  number,
  object,
  objectId,
  record,
  schema,
  string,
  uuid,
  v,
} from "./index";

describe("validator index", () => {
  it("re-exports the schema factories", () => {
    expect(v).toEqual({
      string,
      number,
      bigint,
      boolean,
      date,
      email,
      uuid,
      objectId,
      cpf,
      cnpj,
      cpfCnpj,
      enum: enumValue,
      array,
      object,
      record,
      schema,
    });
  });

  it("re-exports the document formatters", () => {
    expect(formatValidCpf("77388332707")).toBe("773.883.327-07");
    expect(formatValidCnpj("KQGLDO7R000138")).toBe("KQ.GLD.O7R/0001-38");
    expect(formatValidCpfOrCnpj("77388332707")).toBe("773.883.327-07");
  });
});
