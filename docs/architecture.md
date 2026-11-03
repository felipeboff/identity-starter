# Architecture decisions

Why the code looks the way it does. Each section is the current state of one decision: what was
chosen, why, the costs accepted and the options turned down. A change to one of these decisions
updates its section in the same change as the code; a new decision adds a section.

The original dated records (ADR-001 to ADR-015, with the full context and every option weighed)
are in git history at commit `279739e` (`git show 279739e:docs/adr/<file>`).

## Transport-neutral handlers

- One `Handler` per entry point (`src/shared/presentation/handler.ts`), wrapped by `Middleware`s.
  It receives an `Inbound` (`input`, `metadata`, `ip`, `actor`) and returns the use case's output;
  it knows no HTTP, queue or MCP vocabulary. Errors are thrown up the chain and each adapter
  translates them once.
- Each handler declares `name` (`<module>.<operation>`, snake_case), `input` (a TypeBox schema)
  and, when it answers a body, `output`. The `Dispatcher` runs the middlewares, then
  `SchemaParser` (`Clone → Default → Convert → Clean → Errors → Decode`). A refusal is
  `400 shared.input_invalid` with `data.violations = [{ field, reason }]`, where `reason` is the
  JSON Schema keyword (`minLength`, `format`, `required`).
- A transport binds an `Entry` (`{ middlewares?, handler }`) with a small declaration:
  `HttpRoute` (method, path, status, failures), `OutboxConsumer` (effect type), `MessageConsumer`
  (event), `ScheduledJob` (name, cron schedule). `McpTool` is planned on the same model.
- HTTP: `input` is `{ ...query, ...body, ...params }`, params last so a body never overrides a
  path id. Errors are RFC 9457 problem details with `type: "tag:<APP_NAME>,2026:<code>"`, `code`
  and `data`; anything that is not an `AppError` is `500 shared.internal`. The OpenAPI document is
  generated from the routes and their schemas.
- Domain and application import no library (ESLint). TypeBox lives in presentation,
  infrastructure and `src/app` only.

**Why.** Every handler does the same three things (validate, attach the caller, call the use
case), so the transport-specific parts belong to the binding and the adapter. A TypeBox schema
already is JSON Schema, so validation, OpenAPI and a future MCP `inputSchema` cannot drift apart.

**Costs accepted.**

- A status per outcome or a success header (`Location`, a cookie) needs an explicit extension of
  `HttpRoute`; a middleware cannot add response headers.
- `reason` uses TypeBox's vocabulary, which we do not own, and a refusal lists at most 8
  violations (`maxErrors`).
- `Convert` truncates `"12.5"` into `Type.Integer`; a whole number that must refuse a fraction is
  `Type.Number({ multipleOf: 1 })`. No trimming or lower-casing at the edge: normalization stays
  in value objects.

**Turned down.** One contract per transport (the validate-and-call code repeats, or MCP fakes
HTTP requests). Handlers typed on Express or Fastify (a framework switch rewrites every handler).
The in-house validator taught to emit JSON Schema (ours to maintain, in three copies). Valibot
(JSON Schema only through a converter that cannot describe `transform`). Name and schema on each
binding (the same input described once per transport).

## Use-case access

- `UseCase` (`src/shared/application/use-cases.ts`) requires `abstract readonly access`, typed
  from the use-case shape. Without an actor it accepts only `Access.ANYONE`. With one it accepts
  `Access.MEMBER` or a requirement with at least one of `permissions` (all of them),
  `anyPermissions` (one of them) and `roles` (one of them).
- The base checks it before `execute`, in that order, and refuses with
  `403 shared.permission_missing` (`data.required` or `data.anyOf`) or `403 shared.role_missing`
  (`data.roles`).
- Rules that depend on the input or the target (the account owner, granting only what you hold)
  stay in `AccessPolicy` and answer `403 identity.forbidden`.
- A role is a label. A use case may require one; none in identity does.

**Why.** With optional declarations, a forgotten one compiled, passed every test and opened the
operation to every member. Now it does not compile, and `Access.MEMBER` says on purpose what an
absent declaration used to say by accident. The check runs before any read, so a refusal never
reveals whether a record exists.

**Costs accepted.** Every use case carries one more line, `Access.ANYONE` included.
`Access.MEMBER` does not tell "open to any member" from "checked in the body", so the body has to
be read. The check is invisible inside `execute`.

**Turned down.** `ensureX(actor)` in each body (presence and position up to the author). A
`permission` on the `HttpRoute` (a direct `execute` from a job bypasses it). Optional props (a
forgotten one is silent). A second base class for use cases with an actor (a protected use case
can pick the wrong one). A convention test (the mistake shows up late).

## Permission catalog

- Each module declares a `ModulePermissions` (`{ module, permissions }`) from a `const` in its own
  domain and exports it next to `create<Module>Module`. `src/app/permission-catalog.ts` builds one
  `PermissionCatalog` (`src/shared/domain`) from every declaration, used by `start` and by
  `scripts/grant-admin.ts`.
- A code names one operation, `<module>.<subject>.<action>` (`identity.invitation.create`); there
  are no generic codes (`admin`, `write`). The catalog refuses a repeated code, a code without its
  module's prefix and one outside `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$` (up to 100 characters)
  with `shared.invalid_permission_catalog`, so a bad catalog stops the boot.
- Entities store any code. `AccessPolicy` refuses adding a code outside the catalog
  (`400 identity.invalid_membership_permissions`); removing one does not require holding it.
  Codes outside the catalog are inert: no `access` requires them.
- `pnpm identity:grant-admin <email>` stores exactly the catalog; `GET /permissions` lists it to
  any member.

**Why.** A product module protects its use cases without editing identity, and the codes cannot
clash between modules. Loading a membership never fails because a code left the catalog.

**Costs accepted.**

- `Actor.permissions` is `string[]`: a typo in `access` is caught only by using the module's
  `const`.
- Renaming a code is a data change: stored memberships and invitations keep the old code, inert,
  until someone grants the new one.
- A new module's codes reach nobody until an administrator grants them, usually by running
  `grant-admin` again.
- The schemas check the format of a code, so OpenAPI does not list the accepted values.

**Turned down.** A closed list in identity (every module edits identity's domain, and loading
fails when a code leaves the list). Modules registering their codes with identity when created
(depends on creation order, needs a mutable catalog). Granting a new module's codes to admins at
boot (it would turn the role into a rule).

## Access tokens

Identity issues its own tokens, with no external IdP: JWT access tokens (HS256 with `jose`,
`sub` = account id, `sid` = session id, 15 minutes) behind an asynchronous `AccessToken` port,
plus refresh tokens it stores itself. `JoseAccessToken.verify` returns `null` for an expired,
tampered, `alg: none` or foreign-secret token.

**Why.** Verification is where JWT bugs live (algorithm confusion, missing expiry checks), and
`jose` handles them; its API is asynchronous, so the port is too. Moving to RS256, EdDSA or a
remote JWKS touches only the adapter.

**Costs accepted.** Every caller awaits the port; a small async cost on every authenticated
request.

**Turned down.** A synchronous port signing HS256 by hand with `node:crypto`.

## Repository writes

- Every write goes through `OptimisticWriter` (`src/shared/infrastructure/mongo/optimistic-writer.ts`).
  An entity at version 0 is inserted with version 1 (a repeated `_id` is
  `409 shared.already_exists`); otherwise `updateOne({ _id, version }, { $set, $inc: { version: 1 } })`,
  and no match is `409 shared.version_conflict` with `{ id, version }`.
- In-memory repositories follow the same rules; one contract suite per repository port runs
  against both implementations.
- A use case that writes more than one entity wraps the writes in `transactions.run`
  (`TransactionRunner` port; `MongoTransactionRunner` on the driver's `withTransaction`, which
  retries transient errors). External calls (the OAuth code exchange, password hashing) stay
  outside it. `markAsSaved()` runs only on commit, and a nested `run` joins the outer one.
- Mongo runs as a replica set everywhere (compose, tests), because transactions need one.

**Why.** Two requests that load and save the same entity would otherwise erase each other
silently, and a failure between two writes left states no route could fix (a credential with no
account, a reset link that worked twice).

**Costs accepted.** `save` can throw `shared.version_conflict`, so a caller reloads or the client
retries. Saving the same instance twice needs `markAsSaved()` in between.

**Turned down.** Last write wins (silent data loss). Pessimistic locks (cleanup, or a transaction
on every write). A Unit of Work with change tracking (no use case changes enough entities to pay
for it).

## Outbound HTTP

- Every external call (MailerSend, Google, GitHub) goes through `FetchHttpClient`
  (`src/shared/infrastructure/http/fetch-http-client.ts`) on native `fetch`. No vendor SDK.
- One deadline per call, `AbortSignal.timeout` of 10 s, covering attempts, waits and the body
  read.
- `ky`, imported only there, retries a `GET` up to 2 times on a network error or
  `408`/`500`/`502`/`503`/`504`, with full-jitter backoff, and logs
  `shared.external_call_retried`. A `POST` is sent once.
- Timeouts and network failures come back as `{ ok: false, failure }`; each adapter turns them
  into its own `AppError`.

**Why.** The MailerSend SDK had no timeout and no `AbortSignal`, and SDKs throw shapeless errors.
An OAuth sign-in exchanges a single-use code and then reads the profile, so one dropped `GET`
should not send the user back to the consent screen. The code exchange and the MailerSend `POST`
are not idempotent, so they are never retried inside the request.

**Costs accepted.** Request and response shapes are written by hand, and vendor changes do not
arrive through an SDK upgrade. `Retry-After` and `429` are not honoured inside a request; work
that needs a later retry goes through the outbox.

**Turned down.** Vendor SDKs raced against a timeout (the losing request stays open). A
hand-written retry loop. `cockatiel` (no notion of HTTP method or status).

## Outbox and jobs

- A use case writes a side effect with `Outbox.publish` (`kind: "effect"`, type
  `<module>.<effect>`) inside its `transactions.run`, into the Mongo `outbox` collection, so the
  effect exists only if the data that needs it was committed.
- `OutboxRelay`, in the API process, polls every second, reserves a due entry with one
  `findOneAndUpdate` and hands an effect to BullMQ's `outbox` queue (`jobId` = entry id), holding
  it for 2 h. It starts after the server listens and stops before Redis and Mongo close.
- A BullMQ worker (5 at a time, 8 attempts, exponential backoff from 30 s with full jitter) runs
  the module's `OutboxConsumer` through `OutboxEffectRunner`, which writes `processedAt` or
  `failedAt`. A payload the schema refuses, or a type with no consumer, fails at once. The handler
  gets the entry id in `metadata["effect-id"]` to skip an effect it already applied.
- A finished entry loses its payload; a TTL index removes it 7 days later.
- Modules declare `ScheduledJob`s (cron pattern and time zone) like routes; `start` keeps one
  BullMQ job scheduler per declared job and removes the others, so each occurrence runs once
  across instances. No module declares one yet.

**Why.** E-mails sent after the commit were lost on a crash and never retried. BullMQ brings
retry, concurrency and once-per-occurrence schedules on the Redis that already runs.

**Costs accepted.**

- At least once: a crash after the send and before the mark resends. Harmless for e-mails, the
  second copy carries the same link.
- The plain-text token sits in Mongo and in the Redis job data until the job ends.
- Redis must run with `maxmemory-policy noeviction`; e-mails pause, without being lost, while it
  is down.
- Each instance polls Mongo once per second while idle, so an effect waits up to 1 s.
- An abandoned effect is visible only in the log.

**Turned down.** Sending in memory after the commit (lost on a crash, never retried). Change
streams (a later retry still needs a clock, and the resume token must be stored). BullMQ alone,
enqueued after the commit (a crash or a Redis outage in between loses the effect). `node-cron`
(every instance fires). Agenda (polls Mongo for what Redis already does).

## Events between modules

- A module announces a fact with `Outbox.publish` and `kind: "event"`
  (`<module>.<aggregate>.<action>`, ids and public data, never a secret) in its transaction. The
  relay sends it through the `EventBroker` port on a confirm channel to the `<APP_NAME>.events`
  topic exchange (routing key = type, `messageId` = entry id) and marks it processed once the
  broker confirms.
- A module subscribes by declaring a `MessageConsumer` (`Entry` + `event`); each gets a quorum
  queue `<APP_NAME>.<handler.name>` bound to its event.
- The subscriber records `{ consumer, eventId }` in the Mongo `inbox` (unique, 7-day TTL) and runs
  the handler in the same transaction; a duplicate is acknowledged and skipped.
- An `AppError` is acknowledged and logged. Any other failure republishes a copy with
  `x-attempt` + 1, and the 5th failure goes to `<APP_NAME>.dead`.
- The API does not start without RabbitMQ (`RABBITMQ_URL`) and reconnects while it runs.

**Why.** The publisher knows no subscriber. Each subscriber gets its own copy and runs it once, and
a failing one blocks no other.

**Costs accepted.** The 5 attempts come milliseconds apart, so they barely help with a passing
outage. The dead-letter queue is drained by hand, through the management UI. One more service to
run, and integration tests need Docker. An event the broker refuses waits for the 30 s
reservation.

**Turned down.** Publishing after the commit with no outbox (lost on a crash). Redis Streams
(consumer groups, retry and dead letters by hand). `nack` with `x-delivery-limit` (on RabbitMQ 4
a requeued `nack` does not count: a probe saw 1085 deliveries and no dead letter).

## E-mail

- The `MailSender` port (`src/shared/application/ports`) has one implementation per process,
  created by `notifications` (`MailerSendMailSender`, or `LogMailSender` with `MAILER=log`) and
  handed by `start` to identity through `IdentityRuntime`.
- Identity composes its own e-mails, the ones with a token, behind its `IdentityMailer` port. The
  password reset and the verification e-mail leave as outbox effects; the invitation and the
  e-mail change confirmation are sent inside the request and answer
  `422 identity.email_delivery_failed` when the provider fails. A token never travels in an event.
- `notifications` subscribes to `identity.account.registered` (welcome) and
  `identity.email.changed` (notice to the old address). Each subscriber only records an outbox
  effect, which BullMQ sends with retries.
- Every e-mail is pt-BR, sent as text and HTML with one shared layout.

**Why.** Identity announces facts without knowing who reacts to them, one adapter serves the whole
process, and a security notice survives a provider outage.

**Costs accepted.** The welcome and the verification e-mail leave by different paths, in no set
order. The port lives apart from its adapter.

**Turned down.** The port in `notifications/public.ts` (identity would depend on
`notifications` to send its own e-mails). A MailerSend adapter per module. Welcome and notices
sent by identity (it would know every notice anyone wants).

## Error reporting

- Unexpected errors (`500 shared.internal`) and process crashes go to the `ErrorReporter` port,
  called by `HttpErrorMapper` next to the `shared.unexpected_error` log. Expected failures stay in
  the log only.
- `SentryErrorReporter` (`@sentry/node`) is created by `start` only when `SENTRY_DSN` is set. It
  tags the request fields from the log context through an allow-list (`requestId`, `method`,
  `route`, `operation`, `accountId`) and collects no user data, headers, bodies or query. Errors
  only, no tracing. An unhandled rejection still ends the process (`mode: "strict"`), and `stop`
  flushes with `Sentry.close(2_000)`.
- Without a DSN, `DisabledErrorReporter` does nothing. Locally, `docker compose up` starts Bugsink
  (Sentry-compatible) on `127.0.0.1:8000`.

**Why.** Someone is told about a bug, grouped and counted, while presentation stays free of
vendor imports and no personal data leaves the process.

**Costs accepted.** A configuration error at boot happens before Sentry exists and stays on
stderr. Shutdown can take up to 2 s longer when Sentry does not answer. The local DSN has to be
copied from Bugsink again whenever its container is recreated.

**Turned down.** `Sentry.captureException` inside the mapper (breaks the layer rule). A logger
decorator or `pinoIntegration` (expected failures also log at `error`).

## Delivery image

- `pnpm build` bundles `src/main.ts` with esbuild (ESM, `node24`, `--packages=external`, source
  maps) into `dist/main.js`, resolving the path aliases.
- The multi-stage `Dockerfile` on `node:24-slim` installs with pnpm through corepack
  (`--frozen-lockfile`, `--filter identity-starter`), keeps only `package.json`, production
  `node_modules` and `dist/`, and runs as `node` with `node --enable-source-maps dist/main.js`.
- `docker compose --profile app up -d --wait` runs it next to Mongo, Redis and RabbitMQ.
  `MONGO_URL` carries `directConnection=true` because the replica set member is registered as
  `localhost:27017`.

**Why.** Plain `node` in production, production dependencies only, not root, and stack traces
that still point at `src/**/*.ts`.

**Costs accepted.** Two ways to run locally (`pnpm dev` and the container) to keep equivalent.
The image is about 480 MB, mostly `@sentry/node`. Inside the container, a `SENTRY_DSN` at
`localhost` reaches nothing. Type-checking stays a separate step.

**Turned down.** `tsx` in the image (a transpiler in production). `tsc` plus `tsc-alias` (one
more tool for what esbuild already resolves).
