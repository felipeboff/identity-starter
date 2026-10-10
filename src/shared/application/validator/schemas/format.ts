import { addViolation, failure, resolveInput, result, runRefinements } from '../internal/helpers';
import { EMAIL_PATTERN, OBJECT_ID_PATTERN, UUID_PATTERN } from '../internal/patterns';
import type { BaseOptions, ParseResult, Schema, Violation } from '../types';

export type FormatOptions = BaseOptions<string> & {
  trim?: boolean;
  lowercase?: boolean;
  empty?: boolean;
};

export type EmailOptions = FormatOptions;
export type UuidOptions = FormatOptions;
export type ObjectIdOptions = FormatOptions;

const parseFormattedString = (
  input: unknown,
  options: FormatOptions | undefined,
  invalidReason: 'invalid_email' | 'invalid_uuid' | 'invalid_object_id',
  pattern: RegExp,
  lowercaseByDefault: boolean
): ParseResult<string> => {
  const resolved = resolveInput(input, options);
  if (resolved.done) return resolved.result;
  if (typeof resolved.value !== 'string') return failure(invalidReason);

  let value = options?.trim === false ? resolved.value : resolved.value.trim();
  const shouldLowercase = lowercaseByDefault ? options?.lowercase !== false : options?.lowercase === true;
  if (shouldLowercase) value = value.toLowerCase();
  if (options?.transform) value = options.transform(value);

  const violations: Violation[] = [];
  const allowEmpty = options?.empty === true && value === '';
  if (!allowEmpty && !pattern.test(value)) addViolation(violations, invalidReason);
  violations.push(...runRefinements(value, options?.refine));
  return result(value, violations);
};

export const email = (options?: EmailOptions): Schema<string> => ({
  parse: (input) => parseFormattedString(input, options, 'invalid_email', EMAIL_PATTERN, true),
});

export const uuid = (options?: UuidOptions): Schema<string> => ({
  parse: (input) => parseFormattedString(input, options, 'invalid_uuid', UUID_PATTERN, true),
});

export const objectId = (options?: ObjectIdOptions): Schema<string> => ({
  parse: (input) => parseFormattedString(input, options, 'invalid_object_id', OBJECT_ID_PATTERN, true),
});
