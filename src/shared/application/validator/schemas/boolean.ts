import { failure, resolveInput, result, runRefinements } from '../internal/helpers';
import type { BaseOptions, Schema } from '../types';

export type BooleanOptions = BaseOptions<boolean>;

const coerceBoolean = (input: unknown): boolean | undefined => {
  if (typeof input === 'boolean') return input;
  if (input === 1 || input === BigInt(1)) return true;
  if (input === 0 || input === BigInt(0)) return false;
  if (typeof input === 'string') {
    const normalized = input.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return undefined;
};

export const boolean = (options?: BooleanOptions): Schema<boolean> => ({
  parse(input) {
    const resolved = resolveInput(input, options);
    if (resolved.done) return resolved.result;

    let value = coerceBoolean(resolved.value);
    if (value === undefined) return failure('invalid_boolean');
    if (options?.transform) value = options.transform(value);

    return result(value, runRefinements(value, options?.refine));
  },
});
