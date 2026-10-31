# Outbound retry checks

Profile: light
Plan: `.specs/features/outbound-retry/plan.md`

22 checks in 4 slices · 3 one-way doors · 0 open, of which 0 block

## Checks

Grouped by the plan's slices; numbering runs across the whole feature.

### S1 - A GET with a transient failure is tried again · 4 files · 11 KB · ~3k

**C1** - A `GET` whose first attempt fails with a network error (`TypeError: fetch failed`) and whose second answers `200` returns `{ ok: true, status: 200, body }` of the second, with exactly 2 calls to `fetch` (AC 1)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "retries a GET after a network error and returns the next answer"`

**C2** - A `GET` answering each of `408`, `500`, `502`, `503`, `504` twice and then `200` returns the `200`, with 3 calls to `fetch` (AC 2)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "retries a GET answering"`

**C3** - A `GET` failing with a network error on all 3 attempts returns `{ ok: false, failure: "network" }`, with 3 calls to `fetch` (AC 3)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "returns a network failure after the second retry"`

**C4** - A `GET` answering `503` with `content-type: application/json` on all 3 attempts returns `{ ok: true, status: 503, body }` with the last answer's JSON body parsed, with 3 calls to `fetch` (AC 4)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "returns the last retryable answer after the second retry"`

**C5** - With `Math.random` at its upper bound the 2nd attempt starts at 300 ms and not at 299 ms, and the 3rd at 900 ms and not at 899 ms; with `Math.random` at `0.5` they start at 150 ms and 450 ms (AC 5)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "waits up to 300 ms before the first retry and up to 600 ms before the second"`
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "scales each wait by a random factor"`

**C6** - A `GET` answering `503` with `Retry-After: 120` is tried again by 300 ms (AC 6)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "ignores Retry-After and keeps its own backoff"`

**C7** - A `POST` failing with a network error returns `{ ok: false, failure: "network" }` and a `POST` answering `503` returns `{ ok: true, status: 503 }`, each with exactly 1 call to `fetch` (AC 7)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "sends a POST once even when it fails"`

**C8** - A `GET` answering each of `400`, `401`, `404`, `429` returns that status with 1 call to `fetch` (AC 8)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "does not retry a GET answering"`

**C9** - A `GET` whose `fetch` rejects with a `TypeError` carrying another message returns `{ ok: false, failure: "network" }` with 1 call to `fetch` (AC 9)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "reports a network failure without retrying when fetch rejects for any other reason"`

**C22** - `ky` is in `dependencies` at `^2.2.0` and no file in `src` but `fetch-http-client.ts` imports it (Landing door 1)
Proof: `test "$(node -p "require('./package.json').dependencies.ky")" = "^2.2.0"`
Proof: `test "$(grep -rlE "from \"ky\"" src)" = "src/shared/infrastructure/http/fetch-http-client.ts"`

### S2 - Each call has a single deadline · 2 files · 8 KB · ~2k

**C10** - A `GET` whose attempt never answers returns `{ ok: false, failure: "timeout" }` after `timeoutMs`, with 1 call to `fetch` (AC 10)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "reports a timeout without retrying when an attempt takes longer than the limit"`

**C11** - A `GET` answering `503` whose wait before the retry outlasts `timeoutMs` returns `{ ok: false, failure: "timeout" }`, with 1 call to `fetch` (AC 11)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "reports a timeout when the deadline passes while waiting to retry"`

**C12** - A `200` response whose body never finishes arriving returns `{ ok: false, failure: "timeout" }` after `timeoutMs` (AC 12)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "reports a timeout when the body does not arrive within the limit"`

### S3 - The request and response contract stays the same · 8 files · 45 KB · ~12k

**C13** - `fetch` receives the request's method, URL and headers, and no body when there is none (AC 13)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "sends the method, URL and headers, without a body when there is none"`

**C14** - A `json` body reaches `fetch` as `JSON.stringify(json)` with `content-type: application/json` (AC 14)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "encodes a JSON body"`

**C15** - A `form` body reaches `fetch` as `new URLSearchParams(form).toString()` with `content-type: application/x-www-form-urlencoded` (AC 15)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "encodes a form body"`

**C16** - A caller's `content-type` reaches `fetch` instead of the one derived from the body (AC 16)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "lets the caller's headers win over the content type"`

**C17** - A response with a status outside the retry set returns `{ ok: true, status, body }` with a JSON text parsed, an empty body as `null` and a non-JSON text raw (AC 17)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "returns the status and the JSON body"`
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "returns a null body when the response is empty"`
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "returns the raw text when the body is not JSON"`

**C18** - With no `fetch` option, the client calls the global `fetch` (AC 18)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "uses the global fetch when none is given"`

**C19** - The `FetchOAuthGateway`, `MailerSendIdentityMailer` and `createIdentityModule` specs pass with only the reading of the request handed to `fetch` changed (AC 19)
Proof: `pnpm exec vitest run src/modules/identity/infrastructure/fetch-oauth-gateway.integration.spec.ts`
Proof: `pnpm exec vitest run src/modules/identity/infrastructure/mailersend-identity-mailer.integration.spec.ts`
Proof: `pnpm exec vitest run src/modules/identity/identity.module.integration.spec.ts`

### S4 - Each retry shows up in the log · 2 files · 7 KB · ~2k

**C20** - A `GET` to a URL with a query string that fails twice with a network error and then answers logs two `warn` `shared.external_call_retried` entries, `{ method: "GET", url: <origin + path, no query>, attempt: 1, failure: "network" }` and the same with `attempt: 2` (AC 20)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "logs each retry after a network error"`

**C21** - A `GET` answering `502` and then `200` logs exactly one `warn` `shared.external_call_retried` entry `{ method: "GET", url, attempt: 1, failure: "status", status: 502 }` (AC 21)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/fetch-http-client.integration.spec.ts -t "logs a retry after a retryable status with the status"`

## Coverage

| Set (size)                                      | Member -> proof                                                                       | Unproven |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- | -------- |
| retryable statuses, door 2 (5)                  | C2, table-driven over all 5: `408` · `500` · `502` · `503` · `504`                    | -        |
| GET statuses named as not retried (4)           | C8, table-driven over all 4: `400` · `401` · `404` · `429`                            | -        |
| methods, door 2 (2)                             | `GET` C1 · `POST` C7                                                                  | -        |
| POST failure kinds (2)                          | network C7 · `503` C7                                                                 | -        |
| ways an attempt ends badly (4)                  | recognised network error C1 · other rejection C9 · retryable status C2 · timeout C10  | -        |
| outcome after the last retry (2)                | network C3 · retryable status C4                                                      | -        |
| waits, door 2 (2)                               | before retry 1 C5 · before retry 2 C5                                                 | -        |
| retry timing header, door 2 (1)                 | `Retry-After` C6                                                                      | -        |
| deadline phases, door 3 (3)                     | attempt C10 · wait C11 · body read C12                                                | -        |
| body forms outside the retry set (3)            | JSON C17 · empty C17 · raw text C17                                                   | -        |
| request body forms (3)                          | none C13 · `json` C14 · `form` C15                                                    | -        |
| retry log reasons (2)                           | network C20 · status C21                                                              | -        |
| retry log attempts (2)                          | 1 C20 · 2 C20                                                                         | -        |
| `FetchHttpClient` callers (3)                   | `FetchOAuthGateway` C19 · `MailerSendIdentityMailer` C19 · `createIdentityModule` C19 | -        |
| startup config: client with logger (1 assembly) | `createIdentityModule` C19                                                            | -        |

- Claims naming a status code or response shape: C1-C4, C7, C8, C17, C21 - each proof asserts the `HttpResult` that `send` returns
- No other check claims more than the single case its proof exercises

## Swept

- validation: n/a - no new input; `HttpRequest` keeps its shape and the adapters build it
- failure modes: C3, C4, C10, C11, C12
- idempotency: C7, C8
- authorization: n/a - outbound calls carry the adapter's credentials as today; nothing new decides who may call
- concurrency: n/a - each `send` creates its own deadline signal and `ky` request; the client holds only its constructor options, so concurrent calls share no state
- data lifecycle: n/a - nothing is stored
- dependency failure: C1, C2, C5, C6
- state transitions: n/a - no state machine; the retry count lives inside one `send`
- observability: C20, C21

## Handoff

- S1-S4 = 67 KB across 11 files (`wc -c`, /4) ≈ 17k, under the 150k budget - one builder
- **Boundary:** C1-C22 closed (uncommitted, awaiting the user's review)
- **Settled mid-build:** in the `FetchHttpClient` spec, "returns the status and the JSON body" no longer draws `500` and "returns the raw text when the body is not JSON" answers `403` instead of `502` - both statuses are now retried, AC 17 covers statuses outside the retry set and their bodies are C4. The fake `fetch` in every spec records the request body when it is called, because `ky` leaves the sent `Request` body consumed once `send` returns. The adapter specs give the HTTP client its own `FakeLogger`, so their log assertions stay about the adapter. The retry log fires through `ky`'s `beforeRetry`, after the backoff wait and just before the new attempt. The old `expect(lastInit(fetch)?.signal).toBeInstanceOf(AbortSignal)` is gone: every `Request` carries a signal, so it would always hold; C10 and C12 now prove the deadline signal reaches `fetch`, since their fakes only fail when `request.signal` aborts
- **Abandoned:** nothing
