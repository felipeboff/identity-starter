import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { formatValidCnpj } from "./cnpj";

const VALID_CNPJS = [
  "KQ.GLD.O7R/0001-38",
  "XI.7ET.7WM/0001-70",
  "8M.728.GRA/0001-20",
  "3F.U83.3EJ/0001-82",
  "1U.MOA.ZEU/0001-44",
  "UE.PJ2.EQS/0001-05",
];

const INVALID_CNPJS = [
  "0E.SVN.XRF/0001-00",
  "DC.XW0.GV3/0001-00",
  "F9.66O.95H/0001-00",
  "GX.TJB.V7C/0001-00",
  "W5.KRY.D6K/0001-00",
  "JE.3ZU.A88/0001-00",
];

const randomIndex = (): number =>
  Math.floor(Math.random() * (VALID_CNPJS.length - 1));

describe("formatValidCnpj", () => {
  it("returns null when the check digits are invalid", () => {
    const invalidCnpj = INVALID_CNPJS.at(randomIndex());
    expect(formatValidCnpj(invalidCnpj)).toBeNull();
  });

  it("returns the formatted cnpj when it is valid", () => {
    const validCnpj = VALID_CNPJS.at(randomIndex());
    expect(formatValidCnpj(validCnpj)).toBe(validCnpj);
  });

  it("returns null when the input is missing", () => {
    expect(formatValidCnpj(undefined)).toBeNull();
    expect(formatValidCnpj(null)).toBeNull();
  });

  it("returns null when the cnpj is too short", () => {
    const shortCnpj = VALID_CNPJS.at(randomIndex())?.slice(0, -2);
    expect(formatValidCnpj(shortCnpj)).toBeNull();
  });

  it("returns null for a repeated-digit cnpj", () => {
    expect(formatValidCnpj("00000000000000")).toBeNull();
  });

  it("returns null when the check digits are letters", () => {
    const invalidCnpj =
      VALID_CNPJS.at(randomIndex())?.slice(0, -2) + faker.string.alpha(2);
    expect(formatValidCnpj(invalidCnpj)).toBeNull();
  });

  it("returns null when the second check digit is invalid", () => {
    const invalidCnpj = VALID_CNPJS.at(randomIndex())?.slice(0, -1) + "9";
    expect(formatValidCnpj(invalidCnpj)).toBeNull();
  });
});
