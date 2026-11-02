import { ApiError, type Violation } from "../api/api-error";
import { OAuthFlowError } from "../auth/oauth-flow";

import type { LocaleStore } from "./locale-store";

export type MessageOverrides = Readonly<Record<string, string>>;

export class ErrorMessages {
  constructor(private readonly locales: LocaleStore) {}

  describe(error: unknown, overrides: MessageOverrides = {}): string {
    if (error instanceof OAuthFlowError) return this.describeCode(error.code);
    if (!(error instanceof ApiError)) {
      return error instanceof Error
        ? error.message
        : this.locales.messages.errors.fallback;
    }
    const template =
      overrides[error.code] ??
      this.locales.messages.errors.codes[error.code] ??
      error.problem.title;
    return template.replace("{seconds}", String(error.retryAfterSeconds ?? 60));
  }

  describeCode(code: string): string {
    return this.locales.messages.errors.codes[code] ?? code;
  }

  describeViolation(violation: Violation): string {
    const errors = this.locales.messages.errors;
    const isLength =
      violation.reason === "minLength" || violation.reason === "maxLength";
    if (isLength && /password/i.test(violation.field)) {
      return errors.passwordLength;
    }
    return errors.reasons[violation.reason] ?? errors.invalidValue;
  }
}
