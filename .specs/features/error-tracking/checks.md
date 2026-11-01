# Error tracking checks

Profile: light
Plan: `.specs/features/error-tracking/plan.md`

13 checks in 4 slices · 7 one-way doors · 2 open, of which 0 block (1 blocks go-live)

## Checks

Grouped by the plan's slices; numbering runs across the whole feature.

### S1 - An unexpected error in a request reaches Sentry · 9 files · 30 KB · ~8k

**C1** - An error that is not an `AppError` (an `Error`, a string, `undefined`) is answered `500 shared.internal`, logged as `shared.unexpected_error` and handed to the `ErrorReporter` exactly once; over HTTP, a route whose handler rejects with a `TypeError` (`GET /health` with a failing readiness check) answers `500 shared.internal` and the reporter built by `createServer` holds exactly that error (AC 1)
Proof: `pnpm exec vitest run src/shared/presentation/http/http-error-mapper.spec.ts -t "answers 500, logs and reports"`
Proof: `pnpm exec vitest run src/app/create-server.e2e.spec.ts -t "reports an unexpected error once and answers 500"`

**C2** - An `AppError` of each kind (`invalid_input`, `unauthenticated`, `forbidden`, `not_found`, `conflict`, `precondition_failed`, `rate_limited`) reaches the `ErrorReporter` zero times (AC 2)
Proof: `pnpm exec vitest run src/shared/presentation/http/http-error-mapper.spec.ts -t "does not report an AppError of kind"`

**C3** - With an `ErrorReporter` that throws, an unexpected error is still answered with the same `500 shared.internal` response (AC 3)
Proof: `pnpm exec vitest run src/shared/presentation/http/http-error-mapper.spec.ts -t "still answers 500 when the error reporter throws"`

**C4** - An error reported inside an HTTP request reaches the Sentry ingest as an event whose exception has the error's type, message and a non-empty stack, with `environment` equal to the one given, and tags `requestId`, `method`, `route`, `operation`, `accountId` equal to the log context's values; outside an authenticated request the event has no `accountId` tag (AC 4)
Proof: `pnpm exec vitest run src/shared/infrastructure/errors/sentry-error-reporter.integration.spec.ts -t "sends the exception, the environment and the request fields as tags"`
Proof: `pnpm exec vitest run src/shared/infrastructure/errors/sentry-error-reporter.integration.spec.ts -t "leaves accountId out of the tags when the request has no account"`

**C5** - An error reported inside an HTTP request carrying an `authorization` header, an `x-forwarded-for` IP, a JSON body and an `email` field in the log context reaches the ingest with none of the header value, the IP, the body or the e-mail anywhere in the envelope (AC 5)
Proof: `pnpm exec vitest run src/shared/infrastructure/errors/sentry-error-reporter.integration.spec.ts -t "sends neither the client IP, the headers, the body nor the e-mail"`

**C11** - `@sentry/node` is in `dependencies` at `^11.8.0`, resolved to 11.8.0 in the lockfile, and no production file in `src` but `sentry-error-reporter.ts` imports it (Landing door 1)
Proof: `test "$(node -p "require('./package.json').dependencies['@sentry/node']")" = "^11.8.0"`
Proof: `grep -q "^  '@sentry/node@11.8.0':" pnpm-lock.yaml`
Proof: `test "$(grep -rlE "from \"@sentry/node\"" src --include=*.ts | grep -v "\.spec\.ts$")" = "src/shared/infrastructure/errors/sentry-error-reporter.ts"`

### S2 - A process crash reaches Sentry · 3 files · 8 KB · ~2k

**C6** - A child process that initializes `SentryErrorReporter` against a fake ingest and throws an uncaught exception exits with code 1, and the ingest received an event carrying that exception's message (AC 6)
Proof: `pnpm exec vitest run src/shared/infrastructure/errors/sentry-error-reporter.integration.spec.ts -t "reports an uncaught exception and exits with code 1"`

**C7** - A child process that initializes `SentryErrorReporter` against a fake ingest and leaves a rejected promise unhandled exits with code 1, and the ingest received an event carrying that rejection's message (AC 7)
Proof: `pnpm exec vitest run src/shared/infrastructure/errors/sentry-error-reporter.integration.spec.ts -t "reports an unhandled rejection and exits with code 1"`

### S3 - Off without a DSN, and nothing lost on shutdown · 5 files · 30 KB · ~8k

**C8** - `start` without `SENTRY_DSN` serves `GET /health`, registers no `uncaughtException` or `unhandledRejection` listener on the process and leaves the global Sentry client unchanged (AC 8, restored by door 7)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "starts without Sentry when SENTRY_DSN is not set"`

**C9** - `loadEnv` refuses a `SENTRY_DSN` that is not an `http` or `https` URL with a violation on `SENTRY_DSN`, and reads a valid one as given (AC 9)
Proof: `pnpm exec vitest run src/app/config.spec.ts -t "refuses SENTRY_DSN not an http or https URL"`
Proof: `pnpm exec vitest run src/app/config.spec.ts -t "reads SENTRY_DSN when it is set"`

**C10** - With `SENTRY_DSN` pointing at a fake ingest, an unexpected error answered `500` is in the ingest, with `environment` equal to `NODE_ENV`, as soon as `stop()` resolves; with an ingest that never answers, `stop()` resolves in under 2 500 ms (AC 10, AC 4)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "delivers the pending Sentry events before stop resolves"`
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "stops within the Sentry flush limit when Sentry does not answer"`

**C12** - The no-op reporter wired without a DSN accepts any error without throwing (AC 8)
Proof: `pnpm exec vitest run src/shared/infrastructure/errors/disabled-error-reporter.integration.spec.ts -t "ignores the error"`

### S4 - A local Sentry-compatible viewer · 2 files · 3 KB · ~1k

**C13** - `docker compose up` starts `bugsink`, `mongo` and `redis`; `bugsink` runs `bugsink/bugsink:2.6.1` with no profile, published only on `127.0.0.1:8000` (AC 11, Landing doors 5 and 6)
Proof: `test "$(docker compose config --services | sort | tr '\n' ' ')" = "bugsink mongo redis "`
Proof: `docker compose config --format json | node -e 'const s=JSON.parse(require("fs").readFileSync(0,"utf8")).services.bugsink; process.exit(s.image==="bugsink/bugsink:2.6.1" && s.profiles===undefined && s.ports.length===1 && s.ports[0].host_ip==="127.0.0.1" && String(s.ports[0].published)==="8000" ? 0 : 1)'`

## Coverage

| Set (size)                                          | Member -> proof                                                                                                                                    | Unproven |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| unexpected error shapes (3)                         | C1, table-driven over all 3: `Error` · string · `undefined`                                                                                        | -        |
| `AppError` kinds, not reported (7)                  | C2, table-driven over all 7: `invalid_input` · `unauthenticated` · `forbidden` · `not_found` · `conflict` · `precondition_failed` · `rate_limited` | -        |
| event tags (5)                                      | `requestId` C4 · `method` C4 · `route` C4 · `operation` C4 · `accountId` C4                                                                        | -        |
| data kept out of the event (4)                      | client IP C5 · headers C5 · body C5 · e-mail C5                                                                                                    | -        |
| process crashes (2)                                 | uncaught exception C6 · unhandled rejection C7                                                                                                     | -        |
| `SENTRY_DSN` values (3)                             | absent C8 · invalid C9 · valid C9                                                                                                                  | -        |
| compose services started by `docker compose up` (3) | `bugsink` C13 · `mongo` C13 · `redis` C13                                                                                                          | -        |
| shutdown with Sentry (2)                            | ingest answers C10 · ingest never answers C10                                                                                                      | -        |
| startup config: reporter wiring (2 assemblies)      | `start` with `SENTRY_DSN` C10 · `start` without `SENTRY_DSN` C8                                                                                    | -        |

- Claims naming a status code or response shape: C1, C3 - each proof asserts the mapped response; C1 also crosses the HTTP boundary
- No other check claims more than the single case its proof exercises

## Swept

- validation: C9
- failure modes: C3, C6, C7
- idempotency: n/a - nothing is retried; one unexpected error is reported once (C1)
- authorization: n/a - no new route; the DSN only lets the process write to its Sentry project
- concurrency: existing - the tags come from the request's own `AsyncLocalStorage` store in `AsyncLocalLogContext`, so concurrent requests cannot share them
- data lifecycle: n/a - nothing is stored by the app; retention is configured in Sentry
- dependency failure: C3, C10
- state transitions: n/a - no state machine
- observability: C1, C4

## Handoff

- S1-S3 = 69 KB across the existing files plus ~6 new (`wc -c`, /4) ≈ 18k, under the 150k budget - one builder
- **Boundary:** C1-C12 closed (uncommitted, awaiting the user's review; base `5740669`)
- **Settled mid-build:** C1's HTTP proof uses `GET /health` with a readiness check that rejects, because `execute` is abstract on `UseCase` (absent from its prototype) and `src/app` may not import a module's use case (boundaries rule); the claim was re-worded before its test existed. C8 also asserts the global Sentry client is unchanged: `Sentry.init` with an empty DSN registers no process listener, so the listener count alone could not tell "never initialized" apart. Landing door 4 was appended before the code: Sentry 11 has no `sendDefaultPii`, and `dataCollection` with every category off replaces it; neither is what keeps request data out today, since with `enableRuntimeChannelInjection: false` Sentry attaches no request data at all (a mutant collecting everything survived C5), so the setting guards a future change. C10's `500` comes from a JSON body over `express.json`'s 100 kB limit: body-parser's `PayloadTooLargeError` is not an `AppError`, so it answers `500` today (found while building: oversized and unsupported-encoding bodies answer `500` instead of `413`/`415`; reported to the user, not fixed). `src/**/*.fixture.ts` is excluded from coverage in `vitest.config.ts`, because the crash fixture runs only in a child process. An extra test covers a report made outside any request (no tags). The user committed `outbound-retry` as `5740669` and staged part of this feature during the build
- **Abandoned:** spying on `UseCase.prototype.execute` for C1 - it is abstract, so the prototype has no such property
- **Settled after verification round 1:** round 1 failed C9 only - its `-t` held `(s)`, a regex group, so the proof ran no test; the case is renamed to "not an http or https URL" and the selector follows. The user then asked for Bugsink in compose (Landing door 5, AC 11, C13) and for Sentry to stop being optional (door 6): `SENTRY_DSN` is required, so AC 8 and C8 now prove the refusal of a missing DSN, and C12 is withdrawn with `DisabledErrorReporter`, its only subject. The C8 test "starts without Sentry when SENTRY_DSN is not set" is gone with the requirement it proved; `start.e2e.spec.ts` gives every app a DSN on a closed port (`127.0.0.1:9`). Whether Bugsink 2.6.1 accepts `@sentry/node` 11 events is open: the user asked for no containers to be run
- **Settled after door 7:** the user put `SENTRY_DSN` back to optional (only in the env; the `bugsink` service keeps no profile). C8 is back to the `start` test without a DSN, C12 is back with `DisabledErrorReporter`, and the config refusal of a missing DSN is gone with the requirement; `start.e2e.spec.ts` no longer gives every app a DSN, so the `MaxListenersExceededWarning` from repeated `Sentry.init` calls is gone too. Round 2 of the verification was stopped before it wrote anything, since it was checking the required-DSN state
