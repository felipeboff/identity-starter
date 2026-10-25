# ADR-004: Outbound HTTP With Native `fetch`, Not Vendor SDKs

- **Date**: 2026-10-24
- **Status**: Accepted
- **Deciders**: Felipe Boff
- **Tags**: integration, resilience, dependencies, identity

## Context and Problem Statement

The identity module calls three external APIs: MailerSend (e-mail), Google and GitHub (OAuth code
exchange and profile). Every call needs a timeout, and every failure must become an `AppError`,
because production code may not throw plain `Error`s. The `mailersend` SDK (3.4.1) has no timeout
option and no `AbortSignal`. It throws a plain object (`{ headers, body, statusCode }`) on HTTP
errors and a `gaxios` error on network failures. `arctic`, the OAuth helper, had already been
dropped as discontinued.

## Decision Drivers

- A timeout on every outbound call, cancelling the request rather than only stopping the wait
- One failure shape to translate into `AppError`
- One way to mock external calls in tests
- Few dependencies for a handful of endpoints

## Considered Options

- Native `fetch` behind one shared `FetchHttpClient`
- Vendor SDKs (`mailersend`, an OAuth library), wrapped with `Promise.race` timeouts

## Decision Outcome

Chosen option: **native `fetch` behind `FetchHttpClient`**
(`src/shared/infrastructure/http/fetch-http-client.ts`). Each request gets
`AbortSignal.timeout(timeoutMs)`, which is 10 s in the app. JSON and form bodies are encoded by
the client. Timeouts and network errors come back as `{ ok: false, failure }` instead of being
thrown, so each adapter decides which `AppError` they become. The `mailersend` package was
removed.

Adapters built on it: `MailerSendIdentityMailer` (`POST /v1/email`) and `FetchOAuthGateway`
(Google token + userinfo, GitHub token + `/user` + `/user/emails`).

### Positive Consequences

- Every external call has a real, cancelling timeout
- Adapter specs inject a mocked `fetch`; no SDK internals to stub
- Two fewer transitive dependencies (`gaxios`, `qs`)

### Negative Consequences

- Payloads and response shapes are written by hand and validated with `v` schemas; new vendor
  features (templates, attachments, bulk e-mail) mean more hand-written fields
- Vendor API changes are not picked up by upgrading an SDK

## Pros and Cons of the Options

### Native `fetch` + `FetchHttpClient` ✅ Chosen

- ✅ Uniform timeout, error handling and test mocking
- ✅ No dependency for a few endpoints
- ❌ Hand-written request and response shapes

### Vendor SDKs with `Promise.race`

- ✅ Typed builders and vendor-maintained endpoints
- ❌ The losing request stays open after the timeout; error shapes differ per SDK

## Links

- `.claude/skills/STACK.md`, "Integrations"
- `NEXT-STEPS.md`, section 6
- `.claude/skills/integration-patterns/SKILL.md` (timeouts on every outbound call)
