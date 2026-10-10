import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { formatValidCpf } from "./cpf";

const VALID_CPFS = [
  "773.883.327-07",
  "366.482.395-81",
  "693.154.334-24",
  "572.832.868-70",
  "503.160.285-68",
  "665.211.262-02",
];

const INVALID_CPFS = [
  "000.000.000-00",
  "111.111.111-11",
  "222.222.222-22",
  "333.333.333-33",
  "444.444.444-44",
  "555.555.555-55",
];

const randomIndex = (): number =>
  Math.floor(Math.random() * (VALID_CPFS.length - 1));

describe("formatValidCpf", () => {
  it("returns null for a repeated-digit cpf", () => {
    const invalidCpf = INVALID_CPFS.at(randomIndex());
    expect(formatValidCpf(invalidCpf)).toBeNull();
  });

  it("returns the formatted cpf when it is valid", () => {
    const validCpf = VALID_CPFS.at(randomIndex());
    expect(formatValidCpf(validCpf)).toBe(validCpf);
  });

  it("returns the formatted cpf when a check digit is zero", () => {
    expect(formatValidCpf("773.883.327-07")).toBe("773.883.327-07");
  });

  it("returns null when the input is missing", () => {
    expect(formatValidCpf(undefined)).toBeNull();
    expect(formatValidCpf(null)).toBeNull();
  });

  it("returns null when the cpf is too short", () => {
    const shortCpf = VALID_CPFS.at(randomIndex())?.slice(0, -2);
    expect(formatValidCpf(shortCpf)).toBeNull();
  });

  it("returns null when the cpf is too long", () => {
    expect(formatValidCpf("00000000000000")).toBeNull();
  });

  it("returns null when the check digits are letters", () => {
    const invalidCpf =
      VALID_CPFS.at(randomIndex())?.slice(0, -2) + faker.string.alpha(2);
    expect(formatValidCpf(invalidCpf)).toBeNull();
  });

  it("returns null when the first check digit is invalid", () => {
    expect(formatValidCpf("773.883.327-17")).toBeNull();
  });

  it("returns null when the second check digit is invalid", () => {
    const invalidCpf = VALID_CPFS.at(randomIndex())?.slice(0, -1) + "9";
    expect(formatValidCpf(invalidCpf)).toBeNull();
  });
});
