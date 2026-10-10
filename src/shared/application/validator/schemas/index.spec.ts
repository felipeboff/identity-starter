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
  number,
  object,
  objectId,
  string,
  uuid,
} from "./index";

describe("schemas index", () => {
  it("re-exports the schema factories", () => {
    expect(array).toEqual(expect.any(Function));
    expect(bigint).toEqual(expect.any(Function));
    expect(boolean).toEqual(expect.any(Function));
    expect(cnpj).toEqual(expect.any(Function));
    expect(cpf).toEqual(expect.any(Function));
    expect(cpfCnpj).toEqual(expect.any(Function));
    expect(date).toEqual(expect.any(Function));
    expect(email).toEqual(expect.any(Function));
    expect(enumValue).toEqual(expect.any(Function));
    expect(number).toEqual(expect.any(Function));
    expect(object).toEqual(expect.any(Function));
    expect(objectId).toEqual(expect.any(Function));
    expect(string).toEqual(expect.any(Function));
    expect(uuid).toEqual(expect.any(Function));
  });
});
