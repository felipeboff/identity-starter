# Error tracking

## Problem

An unexpected error (a bug that becomes `500 shared.internal`) is today only one
`shared.unexpected_error` line on the process stdout. Nobody is notified, nothing groups or counts
how many times the same bug happened, and a process crash (an uncaught exception, a promise
rejected with no handler) leaves only what reached stderr. Who pays: the user who keeps hitting the
bug until someone reads the logs, and whoever maintains the system, who finds out from the
complaint.

There is no production evidence (the project has no real traffic yet); the item comes from
`NEXT-STEPS.md`, section 4. The user chose Sentry only, with no OpenTelemetry and no Grafana.

When this ships: with `SENTRY_DSN` set, each unexpected error answered with `500` and each process
crash reach Sentry with the stack trace, the environment and the request context; an expected error
(`AppError`) never goes; without `SENTRY_DSN`, nothing changes.

## Flow

Reuses the `HttpErrorMapper` branch that already separates an unexpected error from an `AppError`
(where `shared.unexpected_error` is logged today) and the request fields `AsyncLocalLogContext`
already carries; adds only a port and its adapter.

1. `ExpressAdapter` (exists, `src/shared/infrastructure/http`) catches the error and calls `HttpErrorMapper.map` (exists, `src/shared/presentation/http`)
2. for an error that is not an `AppError`, `HttpErrorMapper` logs `shared.unexpected_error` as today and calls `ErrorReporter.report(error)` (door 2, in `src/shared/application/ports`)
3. `SentryErrorReporter` (door 1, in `src/shared/infrastructure`) reads the request fields from `AsyncLocalLogContext` (exists) and sends the event to Sentry with them as tags
4. `start` (exists, `src/app/start.ts`) initializes Sentry before connecting to Mongo (door 3), which also registers the handlers for uncaught exceptions and unhandled rejections; without `SENTRY_DSN` it wires a reporter that does nothing (door 7); on `stop`, it waits for pending events before closing
5. out: the same `500` problem details response as today

## Impact

| Front       | What changes                                                                                                                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dependency  | `@sentry/node` comes in (door 1), imported only by the adapter                                                                                                                                                          |
| domain      | new term: `ErrorReporter` - port "report an unexpected error", in `src/shared/application/ports`                                                                                                                        |
| domain      | existing term: `HttpErrorMapper` - now receives `errors: ErrorReporter` in its deps; who builds it: `create-server.ts`, `presentation/testing/identity-http.ts`, `express-adapter.integration.spec.ts` and its own spec |
| domain      | existing term: `createServer` - receives the `ErrorReporter` and hands it to the mapper; who calls it: `start.ts` and `create-server.e2e.spec.ts`                                                                       |
| config      | `Env` gains an optional `SENTRY_DSN` (URL, door 7); `.env.example` shows how to point it at the local Bugsink                                                                                                           |
| behaviour   | with Sentry on, a promise rejected with no handler still terminates the process with code 1 (`strict` mode), as Node does today; Sentry's default (`warn`) would keep the process alive                                 |
| behaviour   | `RunningApp.stop` waits up to 2 000 ms for pending Sentry events before ending                                                                                                                                          |
| docs        | new ADR (unexpected errors to Sentry through the `ErrorReporter` port); `STACK.md` "Errors: Sentry" stops being _planned_; the `NEXT-STEPS.md` item becomes `[x]` for Sentry                                            |
| compose     | new `bugsink` service, started by `docker compose up` (doors 5 and 6); `mongo` and `redis` do not change; the data lives inside the container and goes away with `docker compose down`, and the project's DSN with it   |
| stored data | nothing to migrate                                                                                                                                                                                                      |

## Relations

None - no stored-data shape change.

## Surface

None - nothing consumed outside. The `500` response stays identical.

## Landing

| One-way door                         | Literal shape                                                                                                                                                                                                                                       | Alternative rejected                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Dependency                        | `"@sentry/node": "^11.8.0"` in `dependencies` (11.8.0 published on 2026-10-15), imported only by `SentryErrorReporter`                                                                                                                              | 11.9.0 and 11.10.0 - published less than 14 days before 2026-10-31; 10.x - the previous major, still maintained in parallel, but a new project starts on the current one; Sentry's `pinoIntegration` - would also send the expected failures already logged at `error` (`identity.oauth_provider_failed`, `identity.email_delivery_failed`) |
| 2. `ErrorReporter` port (precedent)  | `export type ErrorReporter = { report(error: unknown): void }` in `src/shared/application/ports/error-reporter.ts`; `HttpErrorMapper` with deps `{ logger, errors: ErrorReporter }`                                                                 | calling `Sentry.captureException` inside `HttpErrorMapper` - presentation imports no library but `typebox` (ESLint layer rule), and the future MCP and queue adapters would each import Sentry; a `Logger` decorator forwarding `error` events - expected failures also log at `error`, so it would need a list of event names              |
| 3. Sentry initialization (precedent) | `Sentry.init({ dsn, environment: NODE_ENV, sendDefaultPii: false, enableRuntimeChannelInjection: false, integrations: [Sentry.onUnhandledRejectionIntegration({ mode: "strict" })] })`, with no `tracesSampleRate`; `Sentry.close(2_000)` on `stop` | the default `warn` mode - a promise rejected with no handler would stop terminating the process, unlike today; Sentry tracing (`tracesSampleRate`, `enableOpenTelemetrySetup`) - the user chose errors only; initializing through `--import` before the app - only needed for Sentry's tracing instrumentation, which stays off             |

| One-way door                                                                               | Literal shape                                                                                                                     | Alternative rejected                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4. What Sentry collects (found while building; replaces `sendDefaultPii: false` in door 3) | `dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false }` in `Sentry.init` | `sendDefaultPii: false` - the option no longer exists in Sentry 11 (`NodeOptions` has no such key, so typecheck fails); the `dataCollection` defaults - they collect user info, cookies, headers, bodies and query params |

| One-way door                                                      | Literal shape                                                                                                                                                                                                                                                                   | Alternative rejected                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5. Local error viewer (asked by the user after approval, in chat) | `bugsink: { image: "bugsink/bugsink:2.6.1", profiles: ["errors"], environment: { SECRET_KEY: <fixed local-only value>, CREATE_SUPERUSER: "admin:admin", PORT: "8000" }, ports: ["127.0.0.1:8000:8000"] }` in `docker-compose.yml`; the app reaches it through `SENTRY_DSN` only | Spotlight - needs a code path that turns Sentry on without a DSN; GlitchTip - needs Postgres, Redis and a worker; self-hosted Sentry - dozens of containers; `bugsink/bugsink:2.6.2` - published less than 14 days before 2026-10-31; a service with no profile - `docker compose up` would start it every time |

| One-way door                                                                                                                | Literal shape                                                                                                                                                                                                                            | Alternative rejected                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 6. Sentry is required (asked by the user after approval; supersedes "off without a DSN" and the `errors` profile of door 5) | `SENTRY_DSN: Type.String({ pattern: HTTP_URL })`, required in every `NODE_ENV`; `start` always creates `SentryErrorReporter`; `DisabledErrorReporter` is removed; the `bugsink` service has no profile, so `docker compose up` starts it | `SENTRY_DSN` optional - the user's change: Sentry stops being optional; required only in `prod` - "not optional" from the user, and Bugsink gives every local environment a DSN; keeping the `errors` profile - a required DSN would then depend on remembering the flag |

| One-way door                                                                                 | Literal shape                                                                                                                                                                                    | Alternative rejected                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 7. Sentry optional again (asked by the user; supersedes the required `SENTRY_DSN` of door 6) | `SENTRY_DSN: Type.Optional(Type.String({ pattern: HTTP_URL }))`; `start` creates `SentryErrorReporter` only when it is set, else `DisabledErrorReporter`; the `bugsink` service keeps no profile | a required `SENTRY_DSN` (door 6) - the user changed it back: a `.env` without a DSN must keep booting; putting the `errors` profile back - the user asked only for the env to change |

- Nothing else in this change is hard to reverse

## Criteria

### S1: An unexpected error in a request reaches Sentry (P1)

The bug that became a `500` shows up in Sentry with what is needed to find it.

**Acceptance Criteria**

1. WHEN a route answers `500 shared.internal` because of an error that is not an `AppError` THEN the system SHALL report that error to the `ErrorReporter` exactly 1 time and keep logging `shared.unexpected_error` as today
2. The system SHALL NOT report an `AppError` of any status (`400` to `429`) to the `ErrorReporter`
3. IF the `ErrorReporter` throws THEN the system SHALL answer the same `500 shared.internal`
4. WHEN `SentryErrorReporter` reports an error inside a request THEN the event sent SHALL carry the exception's type, message and stack, `environment` equal to `NODE_ENV`, and as tags the log context fields: `requestId`, `method`, `route`, `operation` and, in an authenticated request, `accountId`
5. The event SHALL NOT carry the client IP, the request headers, the request body or the account e-mail

**Independent test:** with a fake Sentry transport, a test route that throws `TypeError` produces an event with the exception and the tags `requestId`, `method`, `route` and `operation`.

### S2: A process crash reaches Sentry (P1)

The process that dies leaves the reason in Sentry.

**Acceptance Criteria**

6. WHERE `SENTRY_DSN` is set, WHEN an uncaught exception happens THEN the system SHALL send it to Sentry and exit with code 1
7. WHERE `SENTRY_DSN` is set, WHEN a promise is rejected with no handler THEN the system SHALL send it to Sentry and exit with code 1

**Independent test:** a child process with the reporter pointing at a fake ingest server throws an exception; the server receives the event and the process exits with code 1.

### S3: Off without a DSN, and nothing lost on shutdown (P1)

Without configuration nothing changes; with it, shutting down does not drop events.

**Acceptance Criteria**

8. WHERE `SENTRY_DSN` is not set the system SHALL NOT initialize Sentry nor send any event (door 7: optional again, after door 6 had made it required)
9. IF `SENTRY_DSN` is set and is not an `http(s)` URL THEN `loadEnv` SHALL refuse it with a violation on the `SENTRY_DSN` field
10. WHEN the app stops THEN the system SHALL wait up to 2 000 ms for pending Sentry events before ending

**Independent test:** `start` without `SENTRY_DSN` comes up and answers `/health` with Sentry not initialized.

### S4: A local Sentry-compatible viewer (P2)

Asked by the user after approval: errors can be seen locally without a Sentry account.

**Acceptance Criteria**

11. WHEN `docker compose up` runs THEN the system SHALL start `bugsink/bugsink:2.6.1` published on `127.0.0.1:8000` only, next to `mongo` and `redis` (door 6 removed the `errors` profile)

**Independent test:** `docker compose config --services` lists `bugsink`, `mongo` and `redis`.

## Out of scope

| Excluded                                                                               | Why                                                                                                                                                                              |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenTelemetry (traces and metrics) and Grafana                                         | the user's choice: Sentry only                                                                                                                                                   |
| Sentry tracing, profiling and session replay                                           | errors only                                                                                                                                                                      |
| release and source map upload to Sentry                                                | the image runs with `--enable-source-maps` (feature `api-container`), so the stack already arrives pointing at `src/*.ts`; a release needs a version source (CI still _planned_) |
| alert and notification rules                                                           | configured in Sentry's interface, not in code                                                                                                                                    |
| expected failures (`identity.oauth_provider_failed`, `identity.email_delivery_failed`) | they are operational and already in the log; they are not bugs                                                                                                                   |
| configuration error at boot (`loadEnv` refusing)                                       | happens when `config.ts` is imported, before Sentry exists; stays on stderr                                                                                                      |

## Assumptions

Defaults that are not already a numbered criterion. Drop a row once it is.

| Assumption                            | Chosen default                                                      | Rationale                                                                                  | Confirmed? |
| ------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------- |
| `accountId` in the tags               | included                                                            | it is the internal id (ObjectId), not personal data, and it links the error to the account | y          |
| OpenTelemetry and Grafana in the docs | stay _planned_ in `STACK.md` and as an open item in `NEXT-STEPS.md` | the user chose not to do them now; removing them from the stack would be another decision  | y          |

**Open questions:**

| #   | Kind           | Question                                                   | Until answered                                                                  |
| --- | -------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | blocks go-live | Which Sentry project, and which `SENTRY_DSN`?              | the reporter stays off until `SENTRY_DSN` exists in the environment             |
| 2   | open           | Does Bugsink 2.6.1 accept the events of `@sentry/node` 11? | not run here (the user asked for no containers); the first local use answers it |

## Observable

None - no user-facing surface. The `500` response does not change; what changes is for whoever maintains the system.

## Sources

- `NEXT-STEPS.md`, section 4 - "Sentry for errors"; the user chose Sentry only in this conversation
- `.claude/skills/STACK.md`, "Observability" - "Errors: Sentry"
