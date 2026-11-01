import { SentryErrorReporter } from "../infrastructure/errors/sentry-error-reporter";
import { AsyncLocalLogContext } from "../infrastructure/logging/async-local-log-context";

const [dsn = "", crash, message] = process.argv.slice(2);

SentryErrorReporter.create({
  dsn,
  environment: "test",
  context: new AsyncLocalLogContext(),
});

if (crash === "exception") {
  setTimeout(() => {
    throw new Error(message);
  });
} else {
  void Promise.reject(new Error(message));
}
