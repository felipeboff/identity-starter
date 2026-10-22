import {
  failure,
  isPlainObject,
  resolveInput,
  result,
  runRefinements,
} from "../internal/helpers";
import type { BaseOptions, Schema } from "../types";

import { schema } from "./schema";

export type RecordOptions = BaseOptions<Record<string, unknown>>;

export const record = (
  options?: RecordOptions,
): Schema<Record<string, unknown>> =>
  schema((input) => {
    const resolved = resolveInput(input, options);
    if (resolved.done) return resolved.result;
    if (!isPlainObject(resolved.value)) return failure("invalid_object");

    const data: Record<string, unknown> = {};
    for (const key of Object.keys(resolved.value)) {
      Object.defineProperty(data, key, {
        value: resolved.value[key],
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }

    let value = data;
    if (options?.transform) value = options.transform(value);
    return result(value, runRefinements(value, options?.refine));
  });
