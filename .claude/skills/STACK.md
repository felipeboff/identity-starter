# Stack

Decided technologies for resolve-hub. Skills in this folder reference this file instead of
repeating it. Items marked _planned_ are decided but not yet in the codebase. Changes to this
file deserve an ADR (`create-adr`).

## Runtime and HTTP

- **Node.js**, TypeScript, pnpm, ESM.
- **Inbound edge** ([ADR-001](../../docs/adr/001-transport-neutral-handler-layer.md)): one
  transport-neutral `Handler` per entry point, wrapped by `Middleware`s
  (`src/shared/presentation/handler.ts`), bound to each transport by a small declaration: `HttpRoute`
  (method, path, success status), later `McpTool` and `MessageConsumer`. Express (or Fastify), MCP
  and RabbitMQ are thin adapters that build the `Inbound` and translate errors; HTTP errors are
  RFC 9457 problem details. Express is the first adapter (`src/shared/infrastructure/http/`);
  `McpTool` and `MessageConsumer` are _planned_.
- **Dependency injection: manual.** One composition root per module instantiates adapters and
  use cases; no DI container, no decorators.
- **Input validation:** TypeBox (`typebox`, [ADR-005](../../docs/adr/005-typebox-input-schemas-declared-on-the-handler.md)).
  Each handler declares `name` and `input` (a TypeBox schema); the dispatcher interprets it
  through `SchemaParser` (`src/shared/presentation`) after the middlewares. Application and
  domain import no library; TypeBox stays in presentation, infrastructure and `src/app`.
- **API style:** REST, documented with OpenAPI (Swagger UI). _planned_
- **Real-time:** SSE for server → client notifications, when the notifications module needs it.
  _planned_

## Data

- **MongoDB** via **Mongoose**. Schemas and models live only in persistence adapters; domain
  entities never see `Document`, `ObjectId` or schema types. Ids cross the boundary as strings
  wrapped in the shared `Id` value object.
- **Optimistic concurrency** on every repository write (`OptimisticWriter`,
  [ADR-003](../../docs/adr/003-optimistic-concurrency-on-repository-writes.md)).
- **Redis** (ioredis): the `Cache` port (`RedisCache`: get, set, delete, increment, ttl). The
  shared `RateLimiter` sits on it (fixed window, lets requests through if Redis is down).
  BullMQ backend is _planned_.
- **Text search:** MongoDB text index; revisit (Atlas Search / Elasticsearch) only on a real
  relevance need.
- **Attachments:** S3 behind a storage port. _planned_

## Integrations

- **Outbound HTTP** ([ADR-004](../../docs/adr/004-outbound-http-with-native-fetch.md)): native
  `fetch` through the shared `FetchHttpClient`, with a timeout on every call (10 s); no vendor
  SDKs. Timeouts and network failures come back as results, and each adapter turns them into an
  `AppError`. Under it, `ky` retries a `GET` up to 2 times on a network error or
  `408`/`500`/`502`/`503`/`504`, with full-jitter backoff, inside the same 10 s; a `POST` is sent
  once ([ADR-007](../../docs/adr/007-retry-idempotent-outbound-calls-with-ky.md)).

## Messaging and jobs

- **RabbitMQ** for events between modules, published through a transactional outbox stored in
  MongoDB. _planned_
- **BullMQ** for background and scheduled jobs (repeatable jobs replace cron: SLA escalation,
  session cleanup, reminders). _planned_

## Identity

- JWT access tokens (HS256 with `jose`, behind an asynchronous `AccessToken` port,
  [ADR-002](../../docs/adr/002-asynchronous-access-token-port.md)) + refresh tokens issued by the
  project (no external IdP). Passwords hashed with argon2id.
- OAuth providers: Google and GitHub, through `FetchOAuthGateway`. Apple is _planned_.
- Transactional e-mail: MailerSend behind the `IdentityMailer` port; a logging mailer for
  development (`MAILER=log`).

## Observability

- Logs: **Pino**, JSON to stdout (pretty in development), one event per request with its
  request id.
- Log collection outside the process (Alloy/Promtail → Loki). _planned_
- Metrics and traces: **OpenTelemetry** → **Grafana** stack. _planned_
- Errors: **Sentry** (`@sentry/node`) behind the `ErrorReporter` port: unexpected errors (`500`)
  and process crashes, with the request fields as tags and no personal data; off without
  `SENTRY_DSN`, which locally can point at **Bugsink** (Sentry-compatible, started by
  `docker compose up`)
  ([ADR-008](../../docs/adr/008-report-unexpected-errors-to-sentry.md)).

## Delivery

- Docker + Docker Compose. The API image is an esbuild bundle (`pnpm build`, every package external)
  run by `node --enable-source-maps` on `node:24-slim`, as `node`, with production dependencies only;
  `docker compose --profile app up` starts it next to Mongo and Redis
  ([ADR-009](../../docs/adr/009-run-the-api-from-an-esbuild-bundle-in-a-slim-image.md)).
- CI: **GitHub Actions** (lint, typecheck, tests with coverage). _planned_
- Infra: EC2 or VPS, provisioned with **Terraform**. _planned_

## Testing

- Vitest; unit tests next to the code (`*.spec.ts`), 100% coverage target. How to write them:
  [`writing-tests`](writing-tests/SKILL.md) (faker-first data, deterministic branches, helpers).
- Integration tests with `mongodb-memory-server` and `supertest` for the HTTP edge.
- Mutation testing with Stryker is an option when `spec-lean` runs at profile `standard`.
