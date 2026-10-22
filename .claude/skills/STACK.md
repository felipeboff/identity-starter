# Stack

Decided technologies for resolve-hub. Skills in this folder reference this file instead of
repeating it. Items marked _planned_ are decided but not yet in the codebase. Changes to this
file deserve an ADR (`create-adr`).

## Runtime and HTTP

- **Node.js**, TypeScript, pnpm, ESM.
- **Express** behind a thin edge: routes call an HTTP adapter per module that maps request →
  use-case input and result/error → response. Nothing below the adapter imports Express types,
  so the framework can be swapped and the same use cases can be exposed through MCP later.
- **Dependency injection: manual.** One composition root per module instantiates adapters and
  use cases; no DI container, no decorators.
- **Input validation:** the project's own validator in `src/shared/application/validator`.
- **API style:** REST, documented with OpenAPI (Swagger UI). _planned_
- **Real-time:** SSE for server → client notifications, when the notifications module needs it.
  _planned_

## Data

- **MongoDB** via **Mongoose**. Schemas and models live only in persistence adapters; domain
  entities never see `Document`, `ObjectId` or schema types. Ids cross the boundary as strings
  wrapped in the shared `Id` value object.
- **Redis** (ioredis): rate-limit counters, cache, BullMQ backend. _planned_
- **Text search:** MongoDB text index; revisit (Atlas Search / Elasticsearch) only on a real
  relevance need.
- **Attachments:** S3 behind a storage port. _planned_

## Messaging and jobs

- **RabbitMQ** for events between modules, published through a transactional outbox stored in
  MongoDB. _planned_
- **BullMQ** for background and scheduled jobs (repeatable jobs replace cron: SLA escalation,
  session cleanup, reminders). _planned_

## Identity

- JWT access tokens + refresh tokens issued by the project (no external IdP).
- OAuth providers: Google and GitHub. _planned_
- Transactional e-mail: MailerSend behind a mail port. _planned_

## Observability

- Logs: **Pino**, JSON to stdout; collected outside the process (Alloy/Promtail → Loki).
  _planned_
- Metrics and traces: **OpenTelemetry** → **Grafana** stack. _planned_
- Errors: **Sentry**. _planned_

## Delivery

- Docker + Docker Compose.
- CI: **GitHub Actions** (lint, typecheck, tests with coverage). _planned_
- Infra: EC2 or VPS, provisioned with **Terraform**. _planned_

## Testing

- Vitest; unit tests next to the code (`*.spec.ts`), 100% coverage target.
- Integration tests with `mongodb-memory-server` and `supertest` for the HTTP edge. _planned_
- Mutation testing with Stryker is an option when `spec-lean` runs at profile `standard`.
