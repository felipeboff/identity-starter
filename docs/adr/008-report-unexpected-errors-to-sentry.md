# ADR-008: Report Unexpected Errors to Sentry Through an `ErrorReporter` Port

- **Date**: 2026-10-31
- **Status**: Accepted
- **Deciders**: Felipe Boff
- **Tags**: observability, errors, dependencies

## Context and Problem Statement

An unexpected error (a bug answered with `500 shared.internal`) is only a `shared.unexpected_error`
line on stdout, and a process crash leaves only what reached stderr. Nobody is notified, and
nothing groups or counts the same bug. `STACK.md` already planned Sentry for errors; the user chose
Sentry only for now, with no OpenTelemetry and no Grafana. `HttpErrorMapper` is where an unexpected
error is told apart from an `AppError`, and it lives in presentation, which imports no library but
`typebox`.

## Decision Drivers

- Only unexpected errors and crashes reach Sentry; expected failures stay in the log
- Presentation and application stay free of vendor imports
- No personal data in the event: no IP, headers, body or e-mail
- Without a DSN, nothing changes and the process crashes as Node does today

## Considered Options

- An `ErrorReporter` port called by `HttpErrorMapper`, with a Sentry adapter
- `Sentry.captureException` inside `HttpErrorMapper`
- A `Logger` decorator, or Sentry's `pinoIntegration`, forwarding `error`-level logs

## Decision Outcome

Chosen option: **the `ErrorReporter` port** (`src/shared/application/ports/error-reporter.ts`,
`report(error: unknown): void`). `HttpErrorMapper` calls it next to the `shared.unexpected_error`
log. `SentryErrorReporter` (`src/shared/infrastructure/errors/`) sends the error with the request
fields from `AsyncLocalLogContext` as tags (`requestId`, `method`, `route`, `operation`,
`accountId`, an explicit allow-list). `start` creates it only when `SENTRY_DSN` is set, with
`@sentry/node` 11:

- `dataCollection` with user info, cookies, headers, bodies and query params all off
- `enableRuntimeChannelInjection: false` and no tracing (errors only)
- `onUnhandledRejectionIntegration({ mode: "strict" })`, so an unhandled rejection still ends the
  process with code 1, unlike Sentry's default `warn`
- `Sentry.close(2_000)` on `stop`

Without a DSN, `DisabledErrorReporter` does nothing and Sentry is never initialized. Locally,
`docker compose up` starts Bugsink (`bugsink/bugsink:2.6.1`, Sentry-compatible) on `127.0.0.1:8000`,
and `SENTRY_DSN` can point at a project created there.

### Positive Consequences

- A bug that becomes a `500`, and a crash, reach Sentry with enough context to find the request
- Future MCP and queue adapters report through the same port
- Personal data is kept out by an allow-list of tags and by `dataCollection`

### Negative Consequences

- One more dependency, whose major (11) changes options between versions (`sendDefaultPii` became
  `dataCollection`)
- A configuration error at boot happens before Sentry exists and stays on stderr
- Shutdown may take up to 2 s longer when Sentry does not answer
- Locally the DSN has to be copied from Bugsink once, and again whenever its container is
  recreated

## Pros and Cons of the Options

### `ErrorReporter` port ✅ Chosen

- ✅ Keeps the layer rule; one place decides what is reported
- ✅ A fake reporter makes the mapper's behaviour unit-testable
- ❌ One more dependency on `HttpErrorMapper` and `createServer`

### `Sentry.captureException` in `HttpErrorMapper`

- ✅ No new port
- ❌ Breaks the presentation layer rule; every future adapter imports Sentry

### `Logger` decorator or `pinoIntegration`

- ✅ No change to the mapper
- ❌ Expected failures also log at `error`, so it needs a list of event names to skip

## Links

- `.specs/features/error-tracking/plan.md`
- `.claude/skills/STACK.md`, "Observability"
