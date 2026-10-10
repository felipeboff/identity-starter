import { addViolation, failure, resolveInput, result, runRefinements } from '../internal/helpers';
import type { BaseOptions, Schema, Violation } from '../types';

export type EnumOptions<T extends string | number> = BaseOptions<T> & {
  values: readonly T[];
};

export const enumValue = <const T extends string | number>(options: EnumOptions<T>): Schema<T> => ({
  parse(input) {
    const resolved = resolveInput(input, options);
    if (resolved.done) return resolved.result;

    const exists = options.values.some((value) => Object.is(value, resolved.value));
    if (!exists) return failure('invalid_enum');
    let value = resolved.value as T;
    if (options.transform) value = options.transform(value);

    const violations: Violation[] = [];
    if (!options.values.some((allowed) => Object.is(allowed, value))) addViolation(violations, 'invalid_enum');
    violations.push(...runRefinements(value, options.refine));
    return result(value, violations);
  },
});
