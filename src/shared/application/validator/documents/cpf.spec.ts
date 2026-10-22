import { describe, expect, it } from "vitest";

import { formatValidCpf } from "./cpf";

describe("formatValidCpf", () => {
  it.each([
    "773.883.327-07",
    "366.482.395-81",
    "693.154.334-24",
    "572.832.868-70",
    "503.160.285-68",
    "665.211.262-02",
  ])("formats the valid cpf %s", (cpf) => {
    expect(formatValidCpf(cpf)).toBe(cpf);
  });

  it("formats a cpf typed without punctuation", () => {
    expect(formatValidCpf("77388332707")).toBe("773.883.327-07");
  });

  it("maps a check digit remainder of ten to zero", () => {
    expect(formatValidCpf("70499962206")).toBe("704.999.622-06");
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a repeated-digit cpf", "111.111.111-11"],
    ["a cpf that is too short", "773.883.327"],
    ["a cpf that is too long", "00000000000000"],
    ["letters as check digits", "773.883.327-ab"],
    ["a wrong first check digit", "773.883.327-17"],
    ["a wrong second check digit", "773.883.327-09"],
  ])("returns null for %s", (_, cpf) => {
    expect(formatValidCpf(cpf)).toBeNull();
  });
});
