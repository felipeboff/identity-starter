# HTTP handler checks

Profile: light
Plan: `.specs/features/http-handler/plan.md`

## Intent

23 checks in 4 slices · 8 one-way doors · 0 open

## Checks

### S1 - An HTTP handler runs with no framework · 4 files · 8 KB · ~2k

**C1** - With no middleware, the handler receives the exact `HttpRequest` object the adapter passed (AC 1)
Proof: `pnpm exec vitest run src/shared/interfaces/http/http-dispatcher.spec.ts -t "passes the adapter's request to the handler unchanged"`

**C2** - With no middleware, the dispatcher returns the exact `HttpResult` the handler resolved, `{ status: 201, body: { id }, headers: { location } }` (AC 2)
Proof: `pnpm exec vitest run src/shared/interfaces/http/http-dispatcher.spec.ts -t "returns the handler's result unchanged"`

**C3** - Every import in `src/shared/interfaces/http/*.ts` is relative or `@shared/` - no external package (AC 3)
Proof: `pnpm exec vitest run src/shared/interfaces/http/http-boundary.spec.ts -t "imports nothing outside src/shared"`

### S2 - Every failure becomes a response with a fixed contract · 3 files · 8 KB · ~2k

**C4** - A thrown `AppError` gets 400 / 401 / 403 / 404 / 409 / 422 for `invalid_input` / `unauthenticated` / `forbidden` / `not_found` / `conflict` / `precondition_failed` (AC 4)
Proof: `pnpm exec vitest run src/shared/interfaces/http/http-dispatcher.spec.ts -t "maps the kind .* to status"`

**C5** - A `shared.input_invalid` thrown by `Schema.probe` answers `{ type: "tag:resolve-hub,2026:shared.input_invalid", title: "Input invalid", status: 400, code: "shared.input_invalid", data: { violations } }` (AC 5)
Proof: `pnpm exec vitest run src/shared/interfaces/http/http-dispatcher.spec.ts -t "answers an AppError with data as problem details"`

**C6** - an `AppError` coded `identity.invalid_refresh_token` / `unauthenticated` (no data) answers `{ type, title: "Invalid refresh token", status: 401, code }` with no `data` key (AC 6)
Proof: `pnpm exec vitest run src/shared/interfaces/http/http-dispatcher.spec.ts -t "omits data when the AppError has none"`

**C7** - `identity.session_expired` is titled `Session expired` and `shared.input_invalid` is titled `Input invalid` (AC 7)
Proof: `pnpm exec vitest run src/shared/interfaces/http/http-dispatcher.spec.ts -t "titles the code"`

**C8** - Both an `AppError` response and an unexpected-error response carry `content-type: application/problem+json` (AC 8)
Proof: `pnpm exec vitest run src/shared/interfaces/http/http-dispatcher.spec.ts -t "marks the error response as problem json"`

**C9** - `new Error(<message>)` answers `500` with exactly `{ type: "about:blank", title: "Internal Server Error", status: 500, code: "shared.internal" }` (AC 9)
Proof: `pnpm exec vitest run src/shared/interfaces/http/http-dispatcher.spec.ts -t "answers an unexpected error with a bare 500"`

**C10** - An unexpected error reaches `ErrorReporter.report` once, with the thrown value (AC 10)
Proof: `pnpm exec vitest run src/shared/interfaces/http/http-dispatcher.spec.ts -t "reports an unexpected error exactly once"`

**C11** - A thrown `AppError` never reaches `ErrorReporter.report` (AC 11)
Proof: `pnpm exec vitest run src/shared/interfaces/http/http-dispatcher.spec.ts -t "does not report an AppError"`

**C12** - When `ErrorReporter.report` throws, the response is still the `500` of C9 (AC 12)
Proof: `pnpm exec vitest run src/shared/interfaces/http/http-dispatcher.spec.ts -t "still answers 500 when the reporter throws"`

### S3 - Handlers build the success response with `result` · 2 files · 3 KB · ~1k

**C13** - `result.ok(body)` is `{ status: 200, body }` (AC 13)
Proof: `pnpm exec vitest run src/shared/interfaces/http/result.spec.ts -t "ok builds 200"`

**C14** - `result.created(body)` is `{ status: 201, body }` (AC 14)
Proof: `pnpm exec vitest run src/shared/interfaces/http/result.spec.ts -t "created builds 201"`

**C15** - `result.accepted(body)` is `{ status: 202, body }` (AC 15)
Proof: `pnpm exec vitest run src/shared/interfaces/http/result.spec.ts -t "accepted builds 202"`

**C16** - `result.noContent()` is `{ status: 204 }` with no `body` key (AC 16)
Proof: `pnpm exec vitest run src/shared/interfaces/http/result.spec.ts -t "noContent builds 204 with no body"`

**C17** - Each builder given `{ location }` carries `headers: { location }`; given none, the result has no `headers` key (AC 17)
Proof: `pnpm exec vitest run src/shared/interfaces/http/result.spec.ts -t "adds headers only when given"`

### S4 - Middlewares run around the handler · 2 files · 6 KB · ~2k

**C18** - Globals `[g1, g2]` and route middlewares `[r1]` run in the order `g1, g2, r1, handler` (AC 18)
Proof: `pnpm exec vitest run src/shared/interfaces/http/http-dispatcher.spec.ts -t "runs global middlewares, then route middlewares, then the handler"`

**C19** - A middleware calling `next({ ...request, actor })` makes the handler receive that `actor` (AC 19)
Proof: `pnpm exec vitest run src/shared/interfaces/http/http-dispatcher.spec.ts -t "hands on the request a middleware passes to next"`

**C20** - A middleware answering `401` without calling `next` is the response, and the later middleware and the handler never run (AC 20)
Proof: `pnpm exec vitest run src/shared/interfaces/http/http-dispatcher.spec.ts -t "stops when a middleware answers without calling next"`

**C21** - When the handler throws an `AppError` coded `identity.session_not_found` / `not_found`, the middleware's `next` resolves with the `404` problem result instead of rejecting (AC 21)
Proof: `pnpm exec vitest run src/shared/interfaces/http/http-dispatcher.spec.ts -t "resolves next with the error result when something after it throws"`

**C22** - A global middleware adding `x-request-id` to what `next` resolved makes the `404` response carry `x-request-id` next to `content-type` (AC 22)
Proof: `pnpm exec vitest run src/shared/interfaces/http/http-dispatcher.spec.ts -t "returns the result a middleware changed, including an error result"`

**C23** - A middleware throwing an `AppError` coded `identity.forbidden` / `forbidden` answers `403`; a middleware throwing `new Error(<message>)` answers the `500` of C9 and is reported once (AC 23)
Proof: `pnpm exec vitest run src/shared/interfaces/http/http-dispatcher.spec.ts -t "answers a middleware's throw as if the handler threw"`

## Coverage

| Set (size)                             | Member -> proof                                                                   | Unproven |
| -------------------------------------- | --------------------------------------------------------------------------------- | -------- |
| `ErrorKind` -> status (6)              | C4, table-driven over all 6                                                       | -        |
| `title` examples in AC 7 (2)           | `identity.session_expired` C7 · `shared.input_invalid` C7                         | -        |
| error response kinds (2)               | `AppError` C5 · C8 · unexpected C9 · C8                                           | -        |
| `AppError` data presence (2)           | with data C5 · without data C6                                                    | -        |
| `result` builders (4)                  | `ok` C13 · `created` C14 · `accepted` C15 · `noContent` C16                       | -        |
| `result` headers presence (2)          | given C17 · not given C17                                                         | -        |
| chain positions (3)                    | global C18 · route C18 · handler C18                                              | -        |
| where a throw starts (2)               | handler C4 · C9 · middleware C23                                                  | -        |
| what a middleware does with `next` (3) | calls it with a changed request C19 · skips it C20 · changes what it resolved C22 | -        |
| `ErrorReporter` outcomes (3)           | reported once C10 · not reported C11 · reporter throws C12                        | -        |
| `Landing` doors (8)                    | 1 C1 · 2 C5 · 3 C4 · 4 C13 · 5 C9 · 6 C3 · 7 C18 · 8 C21                          | -        |

- Claims naming a status code or response shape: C4-C9, C20-C23 - each proof dispatches through `HttpDispatcher`, the boundary every adapter calls
- No route is added (`Surface` is `None`), so no route owes a status row
- No other check claims more than the single case its proof exercises

## Swept

- validation: C5 - a `Schema.probe` refusal reaches the caller as `400` with its violations
- failure modes: C9, C12, C21
- idempotency: n/a - the dispatcher writes nothing; a retried request is the use case's concern
- authorization: C19, C20 - the middleware mechanism that sets `actor` or refuses; the concrete authentication middleware is out of scope
- concurrency: n/a - the dispatcher keeps no state between dispatches; each call builds its own chain
- data lifecycle: n/a - nothing is stored
- dependency failure: C12 - the reporter failing does not change the answer
- state transitions: n/a - no stateful entity is involved
- observability: C10 - unexpected errors reach `ErrorReporter`; C22 - a global middleware can tag every response, errors included

## Handoff

- S1-S4 = ~7k across ~10 new files in `src/shared` (~25 KB / 4), under the 150k budget - one builder
- **Boundary:** C1-C23 closed (uncommitted, awaiting the user's review)
- **Settled mid-build:** specs in `src/shared` may not import `@/identity` (boundaries rule), so C6, C21 and C23 throw `AppError`s defined in the spec with identity's codes and kinds - same values, different source
- **Abandoned:** none
