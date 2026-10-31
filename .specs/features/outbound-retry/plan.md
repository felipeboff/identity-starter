# Outbound retry

## Problem

A single transient failure on a `GET` to Google or GitHub (a dropped connection, a DNS lookup that
fails for an instant, a `502`/`503` from the provider) fails the user's OAuth sign-in with
`identity.oauth_provider_failed`. Those calls (Google's `userinfo`, GitHub's `/user` and
`/user/emails`) happen **after** the code is exchanged for a token, and the authorization code is
single use: when the profile call fails, the code is already spent, and the user has to redo the
consent at the provider from the start. Whoever signs in with Google or GitHub during a moment of
network or provider instability pays for it.

There is no production evidence (the project has no real traffic yet); the item comes from
`NEXT-STEPS.md`, section 4.

When this ships: an outbound `GET` that fails with a network error or with
`408`/`500`/`502`/`503`/`504` is tried again up to 2 times, with exponential backoff and jitter,
inside the same 10 s limit the call already has today; each retry shows up in the log; a `POST` is
still sent only once.

## Flow

Reuses `FetchHttpClient` with the `HttpResult` contract it already has and the failure translation
each adapter already does; `ky` replaces only the body of `send`.

1. `FetchOAuthGateway` (exists, `src/modules/identity/infrastructure`) calls `FetchHttpClient.send` - `GET` for `userinfo`, `/user` and `/user/emails`, `POST` for the two code exchanges; `MailerSendIdentityMailer` (exists) calls it with `POST /v1/email`
2. `FetchHttpClient` in `src/shared/infrastructure/http` (exists) hands the request to `ky` (door 1) with the retry policy (door 2), under a single deadline per call (door 3)
3. on a `GET` with a network error or status `408`/`500`/`502`/`503`/`504`, `ky` waits the backoff and tries again, up to 2 times; before each retry `FetchHttpClient` logs `shared.external_call_retried` through the `Logger` port (exists)
4. out: the same `HttpResult` as today (`{ ok: true, status, body }` or `{ ok: false, failure }`), and the adapter (exists) turns it into an `AppError` as today

## Impact

| Front       | What changes                                                                                                                                                                                                                                                                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| dependency  | `ky` comes in (door 1), imported only by `fetch-http-client.ts`                                                                                                                                                                                                                                                                                                                |
| domain      | new term: `shared.external_call_retried` - `warn` log event emitted before each retry, in `SharedLogEvent`                                                                                                                                                                                                                                                                     |
| domain      | existing term: `FetchHttpClient` - now requires `logger` in its options; who builds it: `identity.module.ts` and the `fetch-http-client`, `fetch-oauth-gateway` and `mailersend-identity-mailer` specs                                                                                                                                                                         |
| behaviour   | a `GET` with a network error or status `408`/`500`/`502`/`503`/`504` is repeated up to 2 times; the latency ceiling per call stays 10 s (`EXTERNAL_CALL_TIMEOUT_MS`), now counting attempts and waits                                                                                                                                                                          |
| behaviour   | the body of a `408`/`5xx` response comes from `ky`'s `HTTPError.data`: JSON parsed only when the response declares a JSON `content-type`, raw text otherwise, `null` when empty. Before, JSON served as `text/plain` was parsed too. Who reads it: `FetchOAuthGateway` logs `providerError` from the body on an unexpected status; `MailerSendIdentityMailer` ignores the body |
| tests       | the `fetch-http-client`, `fetch-oauth-gateway`, `mailersend-identity-mailer` and `identity.module` specs read the `Request` that `ky` hands to `fetch` (`request.url`, `request.method`, `request.headers`, `await request.text()`) instead of `(url, init)`; the assertions stay the same                                                                                     |
| docs        | new ADR (retry with `ky` inside `FetchHttpClient`) complementing ADR-004; `STACK.md` "Integrations" mentions the retry; the `NEXT-STEPS.md` item becomes `[x]`                                                                                                                                                                                                                 |
| stored data | nothing to migrate                                                                                                                                                                                                                                                                                                                                                             |

## Relations

None - no stored-data shape change.

## Surface

None - nothing consumed outside. The OAuth routes keep their signature and statuses; they only fail less often.

## Landing

| One-way door                                        | Literal shape                                                                                                                                                                                                                                                          | Alternative rejected                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Dependency                                       | `"ky": "^2.2.0"` in `dependencies` (ESM, no dependencies of its own, Node >= 22; 2.2.0 published on 2026-10-09); `import ky, { isHTTPError } from "ky"` only in `fetch-http-client.ts`                                                                                 | a hand-written retry loop inside `send` - backoff, jitter and the method and status filters become our code and tests (the user's choice: `ky`); `cockatiel` - a generic policy with no notion of HTTP method or status, so the filters would still be hand-written; `ky` 1.14.3 - the 1.x line, superseded by 2.x since 2026-04-06                                                                                                                   |
| 2. Retry policy (precedent for every outbound call) | `retry: { limit: 2, methods: ["get"], statusCodes: RETRY_STATUSES, afterStatusCodes: [], jitter: true }` with `RETRY_STATUSES = [408, 500, 502, 503, 504]` and `ky`'s default delay (300 ms × 2^(n−1)); `throwHttpErrors: (status) => RETRY_STATUSES.includes(status)` | repeating `POST` - the Google/GitHub authorization code is single use (the second exchange answers `invalid_grant`) and MailerSend takes no idempotency key (a second e-mail); `ky`'s default list - includes `429` and `413`, which do not clear within one user request; honouring `Retry-After` - a header asking for 30 s inside a 10 s deadline turns a fast `503` into a timeout; `throwHttpErrors: false` - `ky` then does not retry on status |
| 3. One deadline per call (precedent)                | `timeout: false` (`ky`'s per-attempt timer off) and `signal: AbortSignal.timeout(timeoutMs)` created on each `send`, covering attempts, waits and the body read                                                                                                        | `ky`'s per-attempt `timeout` + `retryOnTimeout` - worst case 3 × 10 s + waits on the user's sign-in; `ky`'s `timeout` alone - the timer stops when the headers arrive, and a body that stalls is never cut; `ky`'s `totalTimeout` - only covers the body read through the shortcuts (`.text()`), which drop the status `MailerSendIdentityMailer` checks (`202`)                                                                                      |

- Nothing else in this change is hard to reverse

## Criteria

### S1: A GET with a transient failure is tried again (P1)

The OAuth sign-in survives a network error or an isolated `5xx` from the provider.

**Acceptance Criteria**

1. WHEN a `GET` fails with a network error and the next attempt answers THEN `send` SHALL return `{ ok: true, status, body }` of that answer, with exactly 2 calls to `fetch`
2. WHEN a `GET` answers `408`, `500`, `502`, `503` or `504` THEN the client SHALL try again, up to 2 times (3 calls to `fetch` in total)
3. IF a `GET` still fails with a network error after the 2nd retry THEN `send` SHALL return `{ ok: false, failure: "network" }`, with 3 calls to `fetch`
4. IF a `GET` still answers a retryable status after the 2nd retry THEN `send` SHALL return `{ ok: true, status, body }` of the last answer, with the JSON body parsed when the response declares `content-type: application/json`
5. WHEN the client tries again THEN it SHALL wait a random time between 0 and 300 ms before the 1st retry and between 0 and 600 ms before the 2nd
6. IF the retryable response carries `Retry-After` THEN the client SHALL ignore it and use the wait of AC 5 - a `503` with `Retry-After: 120` is tried again within 300 ms
7. The client SHALL NOT repeat a `POST`: a `POST` that fails with a network error or answers `503` SHALL reach `fetch` exactly 1 time
8. The client SHALL NOT repeat a `GET` that answers any other status (`400`, `401`, `404`, `429`): 1 call to `fetch`
9. IF `fetch` rejects with an error that is neither a network error nor a timeout (a `TypeError` with another message) THEN `send` SHALL return `{ ok: false, failure: "network" }` with 1 call to `fetch`

**Independent test:** a fake `fetch` that answers `503` and then `200` makes `send` of a `GET` return the `200` after 2 calls.

### S2: Each call has a single deadline (P1)

Retrying does not raise the maximum time the user waits for a provider.

**Acceptance Criteria**

10. IF an attempt does not answer within `timeoutMs` (10 000 ms in the app) THEN `send` SHALL return `{ ok: false, failure: "timeout" }` and SHALL NOT start another attempt
11. IF `timeoutMs` passes during the wait before a retry THEN `send` SHALL return `{ ok: false, failure: "timeout" }` without calling `fetch` again
12. IF the response body has not finished arriving within `timeoutMs` THEN `send` SHALL return `{ ok: false, failure: "timeout" }`

**Independent test:** with a `timeoutMs` of 50 ms, a `fetch` that answers `503` and then never answers makes `send` return `timeout` within ~50 ms, with 2 calls.

### S3: The request and response contract stays the same (P1)

The adapters do not notice the engine swap.

**Acceptance Criteria**

13. WHEN `send` receives a request THEN the client SHALL hand `fetch` its method, URL and headers, with no body when there is none
14. WHEN the request has a `json` body THEN the client SHALL send `JSON.stringify(json)` with `content-type: application/json`
15. WHEN the request has a `form` body THEN the client SHALL send it URL-encoded with `content-type: application/x-www-form-urlencoded`
16. WHERE the caller passes its own `content-type` the client SHALL send the caller's value
17. WHEN a response arrives with a status outside `408`/`500`/`502`/`503`/`504` THEN `send` SHALL return `{ ok: true, status, body }` with the body parsed as JSON when the text is JSON, the raw text otherwise and `null` when empty
18. WHERE no `fetch` is given the client SHALL use the global `fetch`
19. The system SHALL keep the failures `FetchOAuthGateway`, `MailerSendIdentityMailer` and `createIdentityModule` report: the current specs pass changing only how they read the request handed to `fetch`

**Independent test:** `pnpm test:integration` passes with the current specs adapted to reading the `Request`.

### S4: Each retry shows up in the log (P2)

An unstable provider becomes visible before it fails for good.

**Acceptance Criteria**

20. WHEN the client tries again after a network error THEN it SHALL log `warn` `shared.external_call_retried` with `{ method: "GET", url, attempt, failure: "network" }`, where `url` is origin + path without the query string and `attempt` is 1 on the 1st retry and 2 on the 2nd
21. WHEN the client tries again after a retryable status THEN it SHALL log `warn` `shared.external_call_retried` with `{ method: "GET", url, attempt, failure: "status", status }`

**Independent test:** a `GET` that answers `502` and then `200` leaves exactly one `shared.external_call_retried` entry with `attempt: 1`, `failure: "status"`, `status: 502`.

## Out of scope

| Excluded                                    | Why                                                                                                                        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| circuit breaker                             | needs state shared across requests and volume to measure an error rate; no real traffic yet, comes back with OpenTelemetry |
| retrying `POST` (code exchange, MailerSend) | needs idempotency on the provider's side; the e-mails get their own retry in the outbox (`NEXT-STEPS.md`, section 5)       |
| retry budget (~10% of volume)               | depends on metrics that do not exist yet                                                                                   |
| metrics and traces of the attempts          | its own item (Sentry and OpenTelemetry, `NEXT-STEPS.md`, section 4)                                                        |

## Assumptions

Defaults that are not already a numbered criterion. Drop a row once it is.

| Assumption                     | Chosen default                                        | Rationale                                                                                                                                                          | Confirmed? |
| ------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| class name                     | stays `FetchHttpClient`, in the same file             | `ky` runs on `fetch` and takes the same injectable `fetch`; the user asked for `ky` "under `FetchHttpClient`"; renaming touches 7 files without changing behaviour | y          |
| where the decision is recorded | new ADR complementing ADR-004, which stays `Accepted` | ADR-004 (native fetch, no vendor SDK) still holds; `ky` is a `fetch` wrapper, not an SDK                                                                           | y          |

**Open questions:** none - all resolved or logged above.

## Observable

None - no user-facing surface. No route, screen or command changes its signature; the OAuth routes only fail less often.

## Sources

- `NEXT-STEPS.md`, section 4 - "Retry on external calls (GitHub and Google `GET`) with backoff; evaluate `ky` under `FetchHttpClient`"; the user chose `ky`
- `docs/adr/004-outbound-http-with-native-fetch.md` - a deadline on every outbound call and failures returned as results
- `.claude/skills/integration-patterns/references/resilience.md` - exponential backoff with full jitter, retry only on idempotent operations
