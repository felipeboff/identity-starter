import { addViolation, failure, resolveInput, result, runRefinements } from '../internal/helpers';
import type { BaseOptions, Schema, Violation } from '../types';

export type StringOptions = BaseOptions<string> & {
  trim?: boolean;
  lowercase?: boolean;
  uppercase?: boolean;
  minLength?: number;
  maxLength?: number;
};

const coerceString = (input: unknown): string | undefined => {
  if (typeof input === 'string') return input;
  if (typeof input === 'boolean') return input ? 'true' : 'false';
  if (typeof input === 'bigint') return input.toString();
  if (typeof input === 'number' && Number.isFinite(input)) return String(input);
  if (input instanceof Date && !Number.isNaN(input.getTime())) return input.toISOString();
  return undefined;
};

export const string = (options?: StringOptions): Schema<string> => ({
  parse(input) {
    const resolved = resolveInput(input, options);
    if (resolved.done) return resolved.result;

    let value = coerceString(resolved.value);
    if (value === undefined) return failure('invalid_string');
    if (options?.trim === true) value = value.trim();
    if (options?.lowercase === true) value = value.toLowerCase();
    if (options?.uppercase === true) value = value.toUpperCase();
    if (options?.transform) value = options.transform(value);

    const violations: Violation[] = [];
    if (options?.minLength !== undefined && value.length < options.minLength) addViolation(violations, 'min_length');
    if (options?.maxLength !== undefined && value.length > options.maxLength) addViolation(violations, 'max_length');
    violations.push(...runRefinements(value, options?.refine));
    return result(value, violations);
  },
});
