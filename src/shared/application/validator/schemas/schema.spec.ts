import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { defineError } from "../../../domain/errors/app-error";
import type { InputInvalidData } from "../../../domain/errors/input-invalid-data";
import { SharedError } from "../../../domain/errors/shared.error";

import { object } from "./object";
import { schema } from "./schema";
import { string } from "./string";

describe("schema", () => {
  const person = object<{ name: string }>({ name: string({ minLength: 1 }) });

  it("exposes the given parse function unchanged", () => {
    const positive = schema<number>((input) =>
      typeof input === "number"
        ? { ok: true, data: input }
        : { ok: false, violations: [{ field: "", reason: "invalid_number" }] },
    );
    const value = faker.number.int();

    expect(positive.parse(value)).toEqual({ ok: true, data: value });
    expect(positive.parse(String(value))).toEqual({
      ok: false,
      violations: [{ field: "", reason: "invalid_number" }],
    });
  });

  describe("probe", () => {
    it("returns the parsed data when the input is valid", () => {
      const name = faker.person.firstName();

      expect(person.probe({ name })).toEqual({ name });
    });

    it("throws SharedError.InputInvalid with the violations by default", () => {
      expect(() => person.probe({ name: "" })).toThrow(
        expect.objectContaining({
          name: "AppError",
          code: SharedError.InputInvalid.code,
          kind: "invalid_input",
          data: { violations: [{ field: "name", reason: "min_length" }] },
        }),
      );
    });

    it("throws the given error definition when one is passed", () => {
      const CreateInputInvalid = defineError<InputInvalidData>(
        "resource.create_input_invalid",
        "invalid_input",
      );

      expect(() => person.probe({}, CreateInputInvalid)).toThrow(
        expect.objectContaining({ code: CreateInputInvalid.code }),
      );
    });
  });
});
