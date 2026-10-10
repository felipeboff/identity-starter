import { faker } from "@faker-js/faker";
import { assert, describe, expect, it } from "vitest";

import { Refine, Violation } from "../types";

import {
  addViolation,
  failure,
  isPlainObject,
  prefixViolations,
  resolveInput,
  result,
  runRefinements,
  success,
} from "./helpers";

describe("helpers", () => {
  describe("success", () => {
    it("wraps a value as a successful parse", () => {
      const value = "test";
      const successResult = success(value);

      expect(successResult.ok).toBe(true);
      expect(successResult.data).toBe(value);
    });
  });

  describe("failure", () => {
    it("wraps a reason and field as a failed parse", () => {
      const field = "email";
      const reason = "invalid";
      const failureResult = failure(reason, field);

      expect(failureResult.ok).toBe(false);
      expect(failureResult.violations).toEqual([{ field, reason }]);
    });
  });

  describe("result", () => {
    it("wraps the value as success when the violation list is empty", () => {
      const value = "test";
      const successResult = result<string>(value, []);

      expect(successResult.ok).toBe(true);
      assert(successResult.ok === true);
      expect(successResult.data).toBe(value);
    });

    it("keeps the given violations as a failed parse", () => {
      const violations: Violation[] = [
        { field: "name", reason: "invalid" },
        { field: "email", reason: "required" },
      ];
      const failureResult = result<string>("test", violations);

      expect(failureResult.ok).toBe(false);
      assert(failureResult.ok === false);
      expect(failureResult.violations).toEqual(violations);
    });
  });

  describe("resolveInput", () => {
    it("leaves a defined value for further parsing", () => {
      const value = faker.lorem.text();
      const resolvedInput = resolveInput(value);

      expect(resolvedInput.done).toBe(false);
      assert(resolvedInput.done === false);
      expect(resolvedInput.value).toBe(value);
    });

    it("finishes with a required violation when the value is missing", () => {
      const resolvedInput = resolveInput(undefined);

      expect(resolvedInput.done).toBe(true);
      assert(resolvedInput.done === true);
      expect(resolvedInput.result.ok).toBe(false);
      assert(resolvedInput.result.ok === false);
      expect(resolvedInput.result.violations).toEqual([
        { field: "", reason: "required" },
      ]);
    });

    it("finishes with undefined when the value is optional and missing", () => {
      const resolvedInput = resolveInput(undefined, { optional: true });

      expect(resolvedInput.done).toBe(true);
      assert(resolvedInput.done === true);
      expect(resolvedInput.result.ok).toBe(true);
      assert(resolvedInput.result.ok === true);
      expect(resolvedInput.result.data).toBeUndefined();
    });

    it("finishes with an invalid_type violation when the value is null", () => {
      const resolvedInput = resolveInput(null);

      expect(resolvedInput.done).toBe(true);
      assert(resolvedInput.done === true);
      expect(resolvedInput.result.ok).toBe(false);
      assert(resolvedInput.result.ok === false);
      expect(resolvedInput.result.violations).toEqual([
        { field: "", reason: "invalid_type" },
      ]);
    });

    it("finishes with null when the value is nullable", () => {
      const resolvedInput = resolveInput(null, { nullable: true });

      expect(resolvedInput.done).toBe(true);
      assert(resolvedInput.done === true);
      expect(resolvedInput.result.ok).toBe(true);
      assert(resolvedInput.result.ok === true);
      expect(resolvedInput.result.data).toBeNull();
    });

    it("leaves the default value for further parsing when the value is missing", () => {
      const defaultValue = faker.lorem.text();
      const resolvedInput = resolveInput(undefined, { default: defaultValue });

      expect(resolvedInput.done).toBe(false);
      assert(resolvedInput.done === false);
      expect(resolvedInput.value).toBe(defaultValue);
    });
  });

  describe("addViolation", () => {
    it("appends a violation with an empty field by default", () => {
      const violations: Violation[] = [];
      const reason = "invalid";

      addViolation(violations, reason);

      expect(violations).toEqual([{ field: "", reason }]);
    });
  });

  describe("runRefinements", () => {
    it("returns an empty list when refinements are omitted", () => {
      const violations = runRefinements(undefined, undefined);

      expect(violations).toEqual([]);
    });

    it("collects a violation for every failing check", () => {
      const refinements: Refine<string>[] = [
        {
          check: (value) => value === faker.lorem.word(),
          reason: faker.lorem.word(),
        },
        {
          check: (value) => value === faker.lorem.word(),
          reason: faker.lorem.word(),
        },
      ];

      const violations = runRefinements(faker.lorem.word(), refinements);

      expect(violations).toHaveLength(2);
    });

    it("ignores checks that pass", () => {
      const refinements: Refine<string>[] = [
        {
          check: () => false,
          reason: faker.lorem.word(),
        },
        {
          check: () => true,
          reason: faker.lorem.word(),
        },
      ];

      const violations = runRefinements(faker.lorem.word(), refinements);

      expect(violations).toHaveLength(1);
    });
  });

  describe("prefixViolations", () => {
    it("uses the prefix as the field when the violation has no field", () => {
      const prefix = faker.lorem.word();
      const reason = faker.lorem.word();
      const violations: Violation[] = [{ field: "", reason }];

      const prefixedViolations = prefixViolations(prefix, violations);

      expect(prefixedViolations).toEqual([{ field: prefix, reason }]);
    });

    it("nests the field under the prefix", () => {
      const prefix = faker.lorem.word();
      const field = faker.lorem.word();
      const reason = faker.lorem.word();
      const violations: Violation[] = [{ field, reason }];

      const prefixedViolations = prefixViolations(prefix, violations);

      expect(prefixedViolations).toEqual([
        { field: `${prefix}.${field}`, reason },
      ]);
    });
  });

  describe("isPlainObject", () => {
    it("accepts a literal object", () => {
      expect(isPlainObject({})).toBe(true);
    });

    it("rejects an array", () => {
      expect(isPlainObject([])).toBe(false);
    });

    it("rejects a string", () => {
      expect(isPlainObject(faker.lorem.word())).toBe(false);
    });

    it("rejects null", () => {
      expect(isPlainObject(null)).toBe(false);
    });

    it("rejects undefined", () => {
      expect(isPlainObject(undefined)).toBe(false);
    });

    it("rejects a Date instance", () => {
      expect(isPlainObject(new Date())).toBe(false);
    });

    it("rejects an Error instance", () => {
      expect(isPlainObject(new Error())).toBe(false);
    });

    it("rejects a Map", () => {
      expect(isPlainObject(new Map())).toBe(false);
    });

    it("rejects a Set", () => {
      expect(isPlainObject(new Set())).toBe(false);
    });
  });
});
