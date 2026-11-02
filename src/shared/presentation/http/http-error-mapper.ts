import { SharedLogEvent } from "../../application/logging/shared.log-event";
import type { ErrorReporter } from "../../application/ports/error-reporter";
import type { Logger } from "../../application/ports/logger";
import { isAppError } from "../../domain/errors/app-error";
import type { AppError, ErrorKind } from "../../domain/errors/app-error";

import type { HttpResponse, ProblemDetails } from "./http-response";

const STATUS_BY_KIND: Record<ErrorKind, number> = {
  invalid_input: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  precondition_failed: 422,
  rate_limited: 429,
};

/** `tag:` URI: a stable identifier, not a page. The year is fixed for good. */
const PROBLEM_TYPE_YEAR = 2026;

const PROBLEM_HEADERS = { "content-type": "application/problem+json" };

const INTERNAL_ERROR: ProblemDetails = {
  type: "about:blank",
  title: "Internal Server Error",
  status: 500,
  code: "shared.internal",
};

export type HttpErrorMapperDeps = {
  appName: string;
  logger: Logger;
  errors: ErrorReporter;
};

export class HttpErrorMapper {
  constructor(private readonly deps: HttpErrorMapperDeps) {}

  map(error: unknown): HttpResponse {
    if (!isAppError(error)) this.report(error);
    const body = isAppError(error) ? this.toProblem(error) : INTERNAL_ERROR;
    return { status: body.status, headers: PROBLEM_HEADERS, body };
  }

  private toProblem(error: AppError<unknown>): ProblemDetails {
    const problem: ProblemDetails = {
      type: `tag:${this.deps.appName},${PROBLEM_TYPE_YEAR}:${error.code}`,
      title: this.titleOf(error.code),
      status: STATUS_BY_KIND[error.kind],
      code: error.code,
    };
    return error.data === undefined
      ? problem
      : { ...problem, data: error.data };
  }

  private titleOf(code: string): string {
    const name = code.slice(code.lastIndexOf(".") + 1).replaceAll("_", " ");
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  private report(error: unknown): void {
    this.ignoringFailure(() =>
      this.deps.logger.error(SharedLogEvent.UnexpectedError, { error }),
    );
    this.ignoringFailure(() => this.deps.errors.report(error));
  }

  private ignoringFailure(action: () => void): void {
    try {
      action();
    } catch {
      // A broken logger or reporter must not change the answer.
    }
  }
}
