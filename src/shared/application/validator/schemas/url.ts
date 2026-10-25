import {
  failure,
  resolveInput,
  result,
  runRefinements,
} from "../internal/helpers";
import type { BaseOptions, Schema } from "../types";

import { schema } from "./schema";

export type UrlOptions = BaseOptions<URL> & {
  protocols?: readonly string[];
};

const DEFAULT_PROTOCOLS: readonly string[] = ["http", "https"];

const coerceUrl = (input: unknown): URL | undefined => {
  if (input instanceof URL) return new URL(input.href);
  if (typeof input === "string") return URL.parse(input.trim()) ?? undefined;
  return undefined;
};

export const url = (options?: UrlOptions): Schema<URL> => {
  const protocols = options?.protocols ?? DEFAULT_PROTOCOLS;
  return schema((input) => {
    const resolved = resolveInput(input, options);
    if (resolved.done) return resolved.result;

    let value = coerceUrl(resolved.value);
    if (!value || !protocols.includes(value.protocol.slice(0, -1))) {
      return failure("invalid_url");
    }
    if (options?.transform) value = options.transform(value);

    return result(value, runRefinements(value, options?.refine));
  });
};
