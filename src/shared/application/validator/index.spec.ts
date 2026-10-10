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
    });
  });

  it("re-exports the document formatters", () => {
    expect(formatValidCpf).toEqual(expect.any(Function));
    expect(formatValidCnpj).toEqual(expect.any(Function));
    expect(formatValidCpfOrCnpj).toEqual(expect.any(Function));
  });
});
