import type {
  BaseOptions,
  ParseFailure,
  ParseResult,
  ParseSuccess,
  Refine,
  Violation,
  ViolationReason,
} from "../types";

export const success = <T>(data: T): ParseSuccess<T> => ({ ok: true, data });

export const failure = (reason: ViolationReason, field = ""): ParseFailure => ({
  ok: false,
  violations: [{ field, reason }],
});

export const result = <T>(value: T, violations: Violation[]): ParseResult<T> =>
  violations.length > 0 ? { ok: false, violations } : success(value);

type ResolvedInput<T> =
  | { done: true; result: ParseResult<T> }
  | {
      done: false;
      value: unknown;
    };

export const resolveInput = <T>(
  input: unknown,
  options?: BaseOptions<T>,
): ResolvedInput<T> => {
  if (input === undefined) {
    if (options?.default !== undefined) {
      return { done: false, value: options.default };
    }
    if (options?.optional === true) {
      return { done: true, result: success(undefined as T) };
    }
    return { done: true, result: failure("required") };
  }
  if (input === null) {
    if (options?.nullable === true) {
      return { done: true, result: success(null as T) };
    }
    return { done: true, result: failure("invalid_type") };
  }
  return { done: false, value: input };
};

export const addViolation = (
  violations: Violation[],
  reason: ViolationReason,
  field = "",
): void => {
  violations.push({ field, reason });
};

export const runRefinements = <T>(
  value: T,
  refine?: Refine<T>[],
): Violation[] => {
  if (!refine) return [];

  const violations: Violation[] = [];
  for (const item of refine) {
    if (!item.check(value)) {
      addViolation(violations, item.reason, item.field);
    }
  }
  return violations;
};

export const prefixViolations = (
  prefix: string,
  violations: Violation[],
): Violation[] =>
  violations.map((violation) => ({
    field: violation.field ? `${prefix}.${violation.field}` : prefix,
    reason: violation.reason,
  }));

export const isPlainObject = (
  input: unknown,
): input is Record<string, unknown> => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(input) as unknown;
  return prototype === Object.prototype || prototype === null;
};
