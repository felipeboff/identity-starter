import * as Sentry from "@sentry/node";

import type { ErrorReporter } from "../../application/ports/error-reporter";
import type { AsyncLocalLogContext } from "../logging/async-local-log-context";

const TAG_FIELDS = [
  "requestId",
  "method",
  "route",
  "operation",
  "accountId",
] as const;

const CLOSE_TIMEOUT_MS = 2_000;

export type SentryErrorReporterOptions = Readonly<{
  dsn: string;
  environment: string;
  context: AsyncLocalLogContext;
}>;

export class SentryErrorReporter implements ErrorReporter {
  private constructor(private readonly context: AsyncLocalLogContext) {}

  static create(options: SentryErrorReporterOptions): SentryErrorReporter {
    Sentry.init({
      dsn: options.dsn,
      environment: options.environment,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      enableRuntimeChannelInjection: false,
      integrations: [
        Sentry.onUnhandledRejectionIntegration({ mode: "strict" }),
      ],
    });
    return new SentryErrorReporter(options.context);
  }

  report(error: unknown): void {
    Sentry.captureException(error, { tags: this.tags() });
  }

  async close(): Promise<void> {
    await Sentry.close(CLOSE_TIMEOUT_MS);
  }

  private tags(): Record<string, string> {
    const fields = this.context.get() ?? {};
    return Object.fromEntries(
      TAG_FIELDS.filter((name) => fields[name] !== undefined).map((name) => [
        name,
        String(fields[name]),
      ]),
    );
  }
}
