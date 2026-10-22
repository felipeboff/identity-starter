import { describe, expect, it } from "vitest";

import { formatValidCnpj } from "./cnpj";

describe("formatValidCnpj", () => {
  it.each([
    "KQ.GLD.O7R/0001-38",
    "XI.7ET.7WM/0001-70",
    "8M.728.GRA/0001-20",
    "3F.U83.3EJ/0001-82",
    "1U.MOA.ZEU/0001-44",
  ])("formats the valid cnpj %s", (cnpj) => {
    expect(formatValidCnpj(cnpj)).toBe(cnpj);
  });

  it("formats a lowercase cnpj typed without punctuation", () => {
    expect(formatValidCnpj("kqgldo7r000138")).toBe("KQ.GLD.O7R/0001-38");
  });

  it("maps a check digit remainder below two to zero", () => {
    expect(formatValidCnpj("UE.PJ2.EQS/0001-05")).toBe("UE.PJ2.EQS/0001-05");
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a repeated-digit cnpj", "00000000000000"],
    ["a cnpj that is too short", "KQ.GLD.O7R/0001"],
    ["letters as check digits", "KQ.GLD.O7R/0001-AB"],
    ["a wrong first check digit", "KQ.GLD.O7R/0001-48"],
    ["a wrong second check digit", "KQ.GLD.O7R/0001-39"],
    ["0E.SVN.XRF/0001-00", "0E.SVN.XRF/0001-00"],
    ["DC.XW0.GV3/0001-00", "DC.XW0.GV3/0001-00"],
    ["F9.66O.95H/0001-00", "F9.66O.95H/0001-00"],
    ["GX.TJB.V7C/0001-00", "GX.TJB.V7C/0001-00"],
    ["W5.KRY.D6K/0001-00", "W5.KRY.D6K/0001-00"],
    ["JE.3ZU.A88/0001-00", "JE.3ZU.A88/0001-00"],
  ])("returns null for %s", (_, cnpj) => {
    expect(formatValidCnpj(cnpj)).toBeNull();
  });
});
