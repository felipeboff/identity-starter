import { failure, isPlainObject, prefixViolations, resolveInput, result, runRefinements } from '../internal/helpers';
import type { BaseOptions, Schema, Shape, Violation } from '../types';

export type ObjectOptions<T extends object> = BaseOptions<T>;

export const object = <T extends object>(shape: Shape<T>, options?: ObjectOptions<T>): Schema<T> => ({
  parse(input) {
    const resolved = resolveInput(input, options);
    if (resolved.done) return resolved.result;
    if (!isPlainObject(resolved.value)) return failure('invalid_object');

    const data: Record<string, unknown> = {};
    const violations: Violation[] = [];
    const keys = Object.keys(shape) as Array<keyof T & string>;
    for (const key of keys) {
      const exists = Object.prototype.hasOwnProperty.call(resolved.value, key);
      const parsed = shape[key].parse(exists ? resolved.value[key] : undefined);
      if (!parsed.ok) {
        violations.push(...prefixViolations(key, parsed.violations));
        continue;
      }
      if (parsed.data !== undefined || exists) {
        Object.defineProperty(data, key, {
          value: parsed.data,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
    }
    if (violations.length > 0) return { ok: false, violations };

    let value = data as T;
    if (options?.transform) value = options.transform(value);
    return result(value, runRefinements(value, options?.refine));
  },
});
