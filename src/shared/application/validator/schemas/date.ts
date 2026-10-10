import { addViolation, failure, resolveInput, result, runRefinements } from '../internal/helpers';
import { ISO_DATE_PATTERN, ISO_DATE_TIME_PATTERN } from '../internal/patterns';
import type { BaseOptions, Schema, Violation } from '../types';

export type DateOptions = BaseOptions<Date> & {
  min?: Date;
  max?: Date;
  requireOffset?: boolean;
};

const isValidIsoCalendarDate = (input: string): boolean => {
  const date = new Date(`${input}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === input;
};

const parseIsoDate = (input: string, requireOffset: boolean): Date | undefined => {
  if (!requireOffset && ISO_DATE_PATTERN.test(input)) {
    return isValidIsoCalendarDate(input) ? new Date(`${input}T00:00:00.000Z`) : undefined;
  }
  if (!ISO_DATE_TIME_PATTERN.test(input)) return undefined;
  if (!isValidIsoCalendarDate(input.slice(0, 10))) return undefined;
  const timestamp = Date.parse(input);
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp);
};

const coerceDate = (input: unknown, requireOffset: boolean): Date | undefined => {
  if (typeof input === 'string') return parseIsoDate(input.trim(), requireOffset);
  if (input instanceof Date && !Number.isNaN(input.getTime())) return new Date(input.getTime());
  if (typeof input === 'number' && Number.isFinite(input)) {
    const parsed = new Date(input);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
};

export const date = (options?: DateOptions): Schema<Date> => ({
  parse(input) {
    const resolved = resolveInput(input, options);
    if (resolved.done) return resolved.result;

    let value = coerceDate(resolved.value, options?.requireOffset === true);
    if (!value) return failure('invalid_date');
    if (options?.transform) value = options.transform(value);

    const violations: Violation[] = [];
    if (options?.min && value < options.min) addViolation(violations, 'min');
    if (options?.max && value > options.max) addViolation(violations, 'max');
    violations.push(...runRefinements(value, options?.refine));
    return result(value, violations);
  },
});
