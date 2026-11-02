# HTTP handler

## Problem

Every use case in the codebase can only be called from TypeScript today. The first HTTP framework
(Express or Fastify) will have to decide, on its own, how a request reaches module code, which
status each `AppError` kind gets, what an error body looks like, what happens to an unexpected
exception and where cross-cutting steps such as authentication run. Whoever writes that first route
decides the public error contract by accident, and switching frameworks later means rewriting every
route, because each was written against that framework's types.

No evidence beyond the codebase itself: there is no route and no client yet.

When this ships, a module exposes a use case by writing an `HttpHandler` that knows no framework
and declaring an `HttpRoute`; plugging in Express, Fastify or MCP later is an adapter that walks the
routes, builds the `HttpRequest` and translates the `HttpResult`, with the error contract and the
middleware chain already fixed. An MCP tool is the same handler: the adapter builds the
`HttpRequest` from the tool arguments.

## Flow

Reuses `AppError` / `ErrorKind` for every failure and the validator's `Schema.probe` for input
refusal (`shared.input_invalid`), instead of a second error or validation path.

1. a future adapter (Express, Fastify or MCP) registers each `HttpRoute` (door 7) and, per call, builds the `HttpRequest` (`params`, `query`, `body`, `headers`, `actor: undefined`) -> `HttpDispatcher` (door 1)
2. `HttpDispatcher` (door 8) - runs the global middlewares, then the route's middlewares, then the route's `HttpHandler`; a middleware may hand a changed request on (authentication fills `actor`) or answer without calling `next`
3. `HttpHandler` (door 1) - validates the part it reads with `Schema.probe` from `src/shared/application/validator` (exists), calls a use case in `src/modules/<module>/application/use-cases` (exists) and returns an `HttpResult` built with `result` (door 4)
4. on anything thrown at any step: `HttpErrorMapper` (doors 2, 3, 5) turns it into an error `HttpResult` right there, so the `next` of the middleware outside it resolves instead of rejecting; a value that is not an `AppError` also goes to the `ErrorReporter` port (new, `src/shared/application/ports`, no door)
5. out: `HttpResult` (`status`, optional `body` and `headers`) - the dispatcher never rejects

## Impact

| Front       | What changes                                                                                                                                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| domain      | new term: `HttpHandler` - receives an `HttpRequest` with no framework type and returns an `HttpResult`; contract in `src/shared/interfaces/http`                                                                                                              |
| domain      | new term: `HttpMiddleware` - runs around the handler, may change the request or answer without calling `next`; global (on the dispatcher) or per route                                                                                                        |
| domain      | new term: `result` - builders of success `HttpResult`s (`ok`, `created`, `accepted`, `noContent`); lives in `src/shared/interfaces/http`                                                                                                                      |
| domain      | new term: `HttpRoute` - `{ method, path, middlewares?, handler }`; each module exports the list of its routes; lives in `src/shared/interfaces/http`                                                                                                          |
| domain      | new term: `ProblemDetails` - the type of the error body (RFC 9457); lives in `src/shared/interfaces/http`                                                                                                                                                     |
| domain      | new term: `ErrorReporter` - port that receives unexpected errors; lives in `src/shared/application/ports`                                                                                                                                                     |
| domain      | existing term: `ErrorKind` - had no transport meaning, now each kind binds one HTTP status; adding a kind becomes a compile error until it gets a status. Nobody branches on `kind` outside tests today                                                       |
| docs        | `.claude/skills/STACK.md` "Runtime and HTTP" says routes call "an HTTP adapter per module"; it changes to "one `HttpHandler` per route, with no framework types, declared in an `HttpRoute`; Express, Fastify and MCP are thin adapters over the same routes" |
| stored data | nothing to migrate                                                                                                                                                                                                                                            |

## Relations

None - no stored-data shape change.

## Surface

None - this feature adds no route. The contract every future route will expose (error body, status
table, response shape) is reviewed as doors 2, 3, 4 and 5 in `Landing`.

## Landing

| One-way door                               | Literal shape                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Alternative rejected                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. `HttpHandler` contract (precedent)      | `type HttpRequest<TActor = undefined> = { params: Record<string, string>; query: Record<string, string \| string[]>; body: unknown; headers: Record<string, string \| string[] \| undefined>; actor: TActor }` and `interface HttpHandler<TActor = undefined> { handle(request: HttpRequest<TActor>): Promise<HttpResult> }`                                                                                                                                                                                                                                                      | a neutral handler taking `{ input, actor }` - loses separate path, query and headers and becomes a copy of the use case; the MCP adapter builds an `HttpRequest` from the tool arguments, so one handler serves HTTP and MCP (user chose)                                                                                                                                           |
| 2. Error body (RFC 9457)                   | header `content-type: application/problem+json` and body `{ "type": "tag:identity-starter,2026:identity.session_expired", "title": "Session expired", "status": 422, "code": "identity.session_expired", "data": { "sessionId": "..." } }`; `type` is `tag:identity-starter,2026:` + `code` (an identifier, not a website); `title` is the last segment of `code` with `_` turned into spaces and the first letter upper-cased; no `data` when the error has none. Typed as `type ProblemDetails = { type: string; title: string; status: number; code: string; data?: unknown }` | own format `{ "error": { "code", "data" } }` - no tool (client, gateway, OpenAPI) recognises it; `type` as a documentation link - needs a website online; `type` omitted (`about:blank`) - the RFC wants `title` to be the status phrase, losing the per-error title; `data` fields spread at the top level - a `status` or `type` key in `data` would collide with the RFC members |
| 3. Kind -> status                          | `invalid_input` 400, `unauthenticated` 401, `forbidden` 403, `not_found` 404, `conflict` 409, `precondition_failed` 422                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `invalid_input` 422 / `precondition_failed` 412 - 412 is about conditional headers (`If-Match`), which this API does not use (user chose)                                                                                                                                                                                                                                           |
| 4. Response shape and `result` (precedent) | `type HttpResult<TBody = unknown> = { status: number; body?: TBody; headers?: Record<string, string> }`; `body` is the output itself, no envelope. Handlers build success with `result.ok(body)` 200, `result.created(body)` 201, `result.accepted(body)` 202, `result.noContent()` 204, each with optional `headers` last; errors never go through `result` - the handler throws an `AppError`                                                                                                                                                                                   | the handler returning only the output and the route declaring the status - cannot pick 200 or 201 per outcome nor set `Location`; a `{ "data": ... }` envelope - one more level in every response; `result.notFound()` and the like - a second error path, outside the kind -> status table and bypassing `ErrorReporter`                                                           |
| 5. Unexpected error                        | `500` with `content-type: application/problem+json` and `{ "type": "about:blank", "title": "Internal Server Error", "status": 500, "code": "shared.internal" }` - no message, no stack                                                                                                                                                                                                                                                                                                                                                                                            | echoing `error.message` - leaks driver and stack details to the caller                                                                                                                                                                                                                                                                                                              |
| 6. Layer folder (precedent)                | `src/shared/interfaces/http/`; module handlers later in `src/modules/<module>/interfaces/http/`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `src/shared/application/` - a handler is edge translation, not application logic; the readme already names `interfaces/` as the layer                                                                                                                                                                                                                                               |
| 7. Route declaration (precedent)           | `type HttpRoute<TActor = undefined> = { method: "GET" \| "POST" \| "PUT" \| "PATCH" \| "DELETE"; path: string; middlewares?: readonly HttpMiddleware<never, unknown>[]; handler: HttpHandler<TActor> }`; `path` uses `:param` (`/sessions/:id`), the same syntax in Express and Fastify; each module exports its `routes`                                                                                                                                                                                                                                                         | each adapter wiring route by route by hand - three adapters repeating the same list, and MCP with no way to know which arguments are `params`                                                                                                                                                                                                                                       |
| 8. Middleware contract (precedent)         | `type HttpNext<TActor> = (request: HttpRequest<TActor>) => Promise<HttpResult>` and `interface HttpMiddleware<TIn = undefined, TOut = TIn> { handle(request: HttpRequest<TIn>, next: HttpNext<TOut>): Promise<HttpResult> }`; global middlewares are `new HttpDispatcher({ middlewares: [...] })` and run before the route's; `next` never rejects                                                                                                                                                                                                                                | framework middleware (`app.use`) for authentication and the like - MCP would not get it and each adapter would repeat it; a `next` that rejects on error - every global middleware would need `try/catch` and could not add a header to an error response                                                                                                                           |

- Nothing else in this change is hard to reverse

## Criteria

### S1: An HTTP handler runs with no framework (P1)

The dispatcher hands the request to the handler and returns its result, with no framework type.

**Acceptance Criteria**

1. WHEN the dispatcher runs a route with no middleware THEN the handler SHALL receive the `HttpRequest` the adapter passed (`params`, `query`, `body`, `headers`, `actor`) unchanged
2. WHEN the handler resolves an `HttpResult` and no middleware changes it THEN the dispatcher SHALL return that same `HttpResult` unchanged
3. The files in `src/shared/interfaces/http/` SHALL import no external package - only code from `src/shared`

**Independent test:** a spec handler that reads `params.id` and returns `result.created({ id }, { location: "/things/<id>" })`, dispatched with a hand-built request.

### S2: Every failure becomes a response with a fixed contract (P1)

The dispatcher turns anything the handler throws into an `HttpResult` and never rejects.

**Acceptance Criteria**

4. WHEN the handler throws an `AppError` THEN the dispatcher SHALL return the status bound to its kind: `invalid_input` 400, `unauthenticated` 401, `forbidden` 403, `not_found` 404, `conflict` 409, `precondition_failed` 422
5. WHEN the handler throws an `AppError` with data THEN the response body SHALL be `{ type: "tag:identity-starter,2026:<code>", title, status, code, data }`, with `status` equal to the response status
6. WHEN the handler throws an `AppError` without data THEN the response body SHALL be `{ type, title, status, code }` with no `data` key
7. WHEN the dispatcher builds the `title` of an `AppError` THEN it SHALL be the part of `code` after the last dot, with `_` replaced by a space and only the first letter upper-cased: `identity.session_expired` -> `Session expired`, `shared.input_invalid` -> `Input invalid`
8. WHEN the dispatcher returns an error response THEN it SHALL carry the header `content-type: application/problem+json`
9. IF the handler throws a value that is not an `AppError` THEN the dispatcher SHALL return `500` with `{ type: "about:blank", title: "Internal Server Error", status: 500, code: "shared.internal" }` and nothing else in the body
10. IF the handler throws a value that is not an `AppError` THEN the dispatcher SHALL pass that value to `ErrorReporter.report` exactly once
11. WHEN the handler throws an `AppError` THEN the dispatcher SHALL NOT call `ErrorReporter.report`
12. IF `ErrorReporter.report` throws THEN the dispatcher SHALL still return the `500` response of criterion 9

**Independent test:** dispatch spec handlers that throw an `AppError` coded `identity.session_expired`, an `AppError` coded `identity.invalid_refresh_token` / `unauthenticated` (no data), a `shared.input_invalid` from `Schema.probe` and `new Error(<message>)`; compare each `HttpResult`.

### S3: Handlers build the success response with `result` (P1)

A handler writes `return result.ok(output)` instead of building the response object by hand.

**Acceptance Criteria**

13. WHEN a handler calls `result.ok(body)` THEN it SHALL get `{ status: 200, body }`
14. WHEN a handler calls `result.created(body)` THEN it SHALL get `{ status: 201, body }`
15. WHEN a handler calls `result.accepted(body)` THEN it SHALL get `{ status: 202, body }`
16. WHEN a handler calls `result.noContent()` THEN it SHALL get `{ status: 204 }` with no `body` key
17. WHEN a `result` builder receives `headers` THEN the result SHALL carry those `headers`; without `headers`, the result SHALL NOT have a `headers` key

**Independent test:** call each builder with and without `{ location: "/things/<id>" }` and compare the whole object.

### S4: Middlewares run around the handler, globally or per route (P1)

Authentication, request ids and logging plug in once and work for every adapter.

**Acceptance Criteria**

18. WHEN the dispatcher runs a route THEN it SHALL run the global middlewares in their order, then the route's middlewares in their order, then the handler: globals `[g1, g2]` and route `[r1]` run as `g1, g2, r1, handler`
19. WHEN a middleware calls `next` with a changed request THEN the next middleware or the handler SHALL receive that changed request (a middleware that sets `actor` makes the handler receive that `actor`)
20. IF a middleware resolves without calling `next` THEN the dispatcher SHALL return that middleware's `HttpResult` and SHALL NOT run the later middlewares or the handler
21. WHEN something after a middleware throws THEN that middleware's `next` SHALL resolve with the error `HttpResult` of S2 instead of rejecting
22. WHEN a middleware changes the `HttpResult` that `next` resolved THEN the dispatcher SHALL return the changed result, including when `next` resolved an error result (a global middleware adding `x-request-id` reaches a `404` response)
23. WHEN a middleware throws THEN the dispatcher SHALL answer as if the handler had thrown it: an `AppError` gets the status of its kind, any other value gets the `500` of criterion 9 and is reported exactly once

**Independent test:** a dispatcher with two recording global middlewares and a route with one recording middleware; then a middleware that answers `401` itself; then a global middleware adding `x-request-id` around a handler that throws an `AppError` coded `identity.session_not_found` / `not_found`.

## Out of scope

| Excluded                                                                    | Why                                                                                                                     |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Express, Fastify and MCP adapters                                           | the user plugs them in afterwards; this feature fixes the `HttpRoute`, `HttpRequest` and `HttpResult` they translate to |
| Generating the MCP tools' `inputSchema` (JSON Schema) from the `v` schemas  | the validator emits no JSON Schema; the MCP adapter will need it, separate feature                                      |
| Concrete middlewares (`AuthenticateMiddleware`, request id, request logger) | authentication needs an identity use case that does not exist yet; the others arrive with the first adapter             |
| Applying middlewares to a group of routes (`HttpRouteGroup`)                | arrives with the first protected identity route; until then a route lists its own middlewares                           |
| Handlers for existing identity use cases                                    | each arrives with the first route that exposes it                                                                       |
| Cookies                                                                     | depend on each framework's API; refresh-token cookies will bring them                                                   |
| Coercing query strings into numbers or booleans                             | the validator has no coercion; a handler reading the query uses string schemas until one needs it                       |
| OpenAPI generation                                                          | planned in STACK.md, separate feature                                                                                   |
| Rate limiting, CORS, secure headers                                         | transport-only concerns; they stay as framework middleware in each adapter                                              |

## Assumptions

| Assumption                                     | Chosen default                                                                                                                                                                                                                | Rationale                                                                                                                         | Confirmed? |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Who validates input                            | each handler calls `Schema.probe` on the part it reads (`request.body`, `request.params`, `request.query`); no base class validates for it                                                                                    | the user asked for a type; `probe` already throws `shared.input_invalid`, which becomes 400 through criterion 4                   | n          |
| Header names and values                        | lower-case names, value `string \| string[] \| undefined` - the shape Node already provides                                                                                                                                   | Express and Fastify expose Node's headers; the adapter passes them on unconverted                                                 | n          |
| Missing body                                   | `body` is `undefined`; the adapter passes the already parsed JSON as it is                                                                                                                                                    | `GET` and `DELETE` have no body; whoever reads the body decides with its schema                                                   | n          |
| Where `actor` comes from                       | the adapter always passes `actor: undefined`; an authentication middleware fills it before the handler                                                                                                                        | keeps authentication in one place for every adapter                                                                               | y          |
| Global middleware typing                       | global middlewares are `HttpMiddleware` (`undefined` -> `undefined`) and never change the request type; type-changing ones (authentication) are per route                                                                     | public routes (sign-in, refresh) have no `actor`, so authentication cannot be global                                              | y          |
| Which `ErrorReporter` runs in production       | only the port and a test fake now; the composition root wires a real one (Pino, then Sentry) with the first adapter                                                                                                           | no logger exists yet (Pino is planned); a console reporter now would be replaced within weeks                                     | n          |
| Year in `type`                                 | `2026`, fixed forever in `tag:identity-starter,2026:`                                                                                                                                                                         | in the `tag:` scheme the year is when the name was minted, not the current year; changing it breaks every client comparing `type` | n          |
| Recording the handler layer and error contract | one ADR in `docs/adr/` via `create-adr`, in the build                                                                                                                                                                         | doors 1, 2, 3 and 8 reach every future module and framework                                                                       | n          |
| How the MCP adapter builds the `HttpRequest`   | arguments named after a `:param` of the `path` go to `params`; the rest go to `query` for `GET` and `DELETE` and to `body` for other methods; an `HttpResult` with `status` >= 400 becomes a tool result with `isError: true` | the rule that lets one handler work without knowing whether the call came from HTTP or MCP; recorded here, built with the adapter | n          |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface                 | Decision                       | Landing                                                          |
| ----------------------- | ------------------------------ | ---------------------------------------------------------------- |
| every future HTTP route | response shape                 | AC 2, 13, 14, 15, 16, 17 - the handler picks it with `result`    |
| every future HTTP route | error shape with its codes     | AC 4, 5, 6, 7, 8, 9 - RFC 9457                                   |
| every future HTTP route | who may call it                | AC 19, 20 - an authentication middleware sets `actor` or answers |
| every future HTTP route | versioning                     | n/a - no route exists; a path prefix is the adapter's choice     |
| every future HTTP route | what happens at the rate limit | n/a - rate limiting belongs to the adapter, out of scope         |

## Sources

- User request (2026-10-21/22): "type http handler", Express, Fastify or MCP plugged in afterwards; `HttpHandler` takes `{ params, query, body, headers }` and MCP uses the same handler for its tools; success built with `result.ok`, `result.created` and the like; status table 400/401/403/404/409/422; RFC 9457 errors with `type` (`tag:`) and `title`; global and per-route middlewares
- RFC 9457 "Problem Details for HTTP APIs" - members `type`, `title`, `status`, extension members; `about:blank` wants `title` to be the status phrase
- `.claude/skills/STACK.md` "Runtime and HTTP" - nothing below the adapter imports framework types
