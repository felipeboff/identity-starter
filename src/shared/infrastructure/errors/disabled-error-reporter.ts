import type { ErrorReporter } from "../../application/ports/error-reporter";

export class DisabledErrorReporter implements ErrorReporter {
  report(_error: unknown): void {}
}
