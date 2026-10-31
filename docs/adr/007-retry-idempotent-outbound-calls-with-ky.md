# ADR-007: Retry Idempotent Outbound Calls With `ky` Inside `FetchHttpClient`

- **Date**: 2026-10-31
- **Status**: Accepted
- **Deciders**: Felipe Boff
- **Tags**: integration, resilience, dependencies, identity

## Context and Problem Statement

`FetchHttpClient` ([ADR-004](004-outbound-http-with-native-fetch.md)) sends each outbound call
once. During an OAuth sign-in, the profile calls to Google (`userinfo`) and GitHub (`/user`,
`/user/emails`) run after the authorization code was exchanged; the code is single use, so one
dropped connection or one `502` from the provider makes the user redo the consent at the provider.
The calls sit inside the user's request, so any retry has to fit the 10 s the call already has.

## Decision Drivers

- Retry only what is safe to repeat: the code exchange is single use and MailerSend takes no
  idempotency key
- Keep the latency ceiling of a call at 10 s, retries included
- Exponential backoff with full jitter, without writing and testing it by hand
- Keep `HttpResult` and the adapters unchanged

## Considered Options

- `ky` under `FetchHttpClient`
- A hand-written retry loop inside `FetchHttpClient.send`
- `cockatiel` retry policy around `fetch`

## Decision Outcome

Chosen option: **`ky` (2.x) under `FetchHttpClient`**, imported only by
`src/shared/infrastructure/http/fetch-http-client.ts`:

- `retry: { limit: 2, methods: ["get"], statusCodes: [408, 500, 502, 503, 504], afterStatusCodes: [], jitter: true }`
  with `ky`'s default delay (300 ms × 2^(n−1)); `throwHttpErrors` is true only for those statuses,
  so every other status comes back as a response
- one deadline per call: `timeout: false` and `signal: AbortSignal.timeout(timeoutMs)` on each
  `send`, covering attempts, waits and the body read
- each retry logs `shared.external_call_retried` (`warn`)

ADR-004 still holds: `ky` is a thin wrapper over `fetch`, not a vendor SDK, and failures still come
back as results for each adapter to translate.

### Positive Consequences

- A network error or a `408`/`5xx` on a `GET` no longer fails the sign-in on its own
- The worst case per call stays 10 s; a timeout is never retried
- Backoff, jitter and the method and status filters are library code

### Negative Consequences

- One more dependency on the outbound path
- `ky`'s per-attempt timer stops at the response headers, so the deadline is our own signal
  instead of `ky`'s `timeout`
- The body of a `408`/`5xx` comes from `HTTPError.data`: JSON is parsed only when the response
  declares a JSON `content-type`
- `Retry-After` and `429` are not honoured within a request; that waits for a retry outside the
  request (outbox, jobs)

## Pros and Cons of the Options

### `ky` under `FetchHttpClient` ✅ Chosen

- ✅ Method and status filters, full jitter and network-error detection built in
- ✅ Takes the same injectable `fetch`, so specs keep mocking `fetch`
- ❌ Its timeout does not cover a body read through the raw `Response`

### Hand-written retry loop

- ✅ No dependency
- ❌ Backoff, jitter, network-error detection and their tests become our code

### `cockatiel`

- ✅ Retry and circuit breaker in one library
- ❌ No notion of HTTP method or status; the filters would still be hand-written

## Links

- [ADR-004: Outbound HTTP With Native `fetch`](004-outbound-http-with-native-fetch.md)
- `.specs/features/outbound-retry/plan.md`
- `.claude/skills/integration-patterns/references/resilience.md`
