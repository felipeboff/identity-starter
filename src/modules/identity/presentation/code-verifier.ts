import type { StringOptions } from "@shared/application/validator";

export const CODE_VERIFIER: StringOptions = {
  optional: true,
  minLength: 43,
  maxLength: 128,
};
