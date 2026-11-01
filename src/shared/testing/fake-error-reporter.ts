import type { ErrorReporter } from "../application/ports/error-reporter";

export class FakeErrorReporter implements ErrorReporter {
  readonly reported: unknown[] = [];

  report(error: unknown): void {
    this.reported.push(error);
  }
}
