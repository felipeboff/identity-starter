---
name: integration-patterns
description: Patterns for talking to external systems and between modules without coupling - Ports & Adapters / Anti-Corruption Layer around every vendor, events with a transactional outbox for cross-module communication, idempotent consumers, and resilience (timeouts, backoff with jitter, circuit breaker, retry budget, bulkhead). Also covers strategic DDD context-map integration patterns. Use when integrating a third-party service (email, OAuth provider, storage, payment, ERP, AI), making a module publish or consume events, deciding sync call vs event between modules, or making a call resilient. Do NOT use for module folder layout, domain-model review (use tactical-ddd), or measuring coupling (use coupling-analysis).
license: CC-BY-4.0
metadata:
  author: Felipe Rodrigues - github.com/felipfr (extracted from evolutionary-modular-architecture 1.0.0)
  version: "1.0.0"
---

# Integration Patterns

Three references, extracted from `evolutionary-modular-architecture`. The parent skill's
flat-by-aggregate folder rules and validation scripts were left out on purpose: this project
keeps layered module folders (`domain/`, `application/`), and only the integration guidance
applies.

| Need                                                                                         | Read                                  |
| -------------------------------------------------------------------------------------------- | ------------------------------------- |
| Wrap an external system; events + outbox between modules; SSE                                | `references/acl-and-communication.md` |
| Timeouts, retries, backoff, circuit breaker, idempotency, bulkhead                           | `references/resilience.md`            |
| Context map, integration patterns between bounded contexts, tactical intensity per subdomain | `references/ddd.md`                   |

Load only the reference the current question needs.

## Project conventions (identity-starter)

- Stack decisions live in [`../STACK.md`](../STACK.md); read it before assuming a technology. Concrete mapping:
  - External vendors behind ports: MailerSend (`MailSenderPort`), S3 (`AttachmentStoragePort`),
    Google/GitHub OAuth (`OAuthProviderPort`), Sentry/OpenTelemetry (observability adapters).
  - Events between modules: RabbitMQ transport, outbox entries in a MongoDB collection written
    in the same Mongoose session as the business change, relay as a BullMQ worker.
  - Retries and schedules: BullMQ (repeatable jobs instead of cron). Circuit breaker and
    backoff wrap outbound HTTP (MailerSend, OAuth, S3).
  - Inbound edge: Express, MCP and RabbitMQ are adapters that build a transport-neutral `Inbound`
    and run the same `Handler` (`docs/architecture.md`); `Request`/`Response` never leak below the adapter.
  - Real-time: SSE, when the notifications module needs it.

- A **port** is an interface under `src/modules/<module>/application/ports/`; the adapter lives
  in that module's infrastructure and is injected. Ports speak the domain's language
  (`MailSenderPort.send(verificationEmail)`), never the vendor's API shape.
- Cross-module calls go only through `@/<module>/public` (`public.ts`). Prefer an event when
  the consumer tolerates eventual consistency; keep a direct call when the caller needs the
  answer to decide.
- Reusable logic is an injected class with a role (service, policy, resolver, adapter), never a
  loose function.
- Describe persisted state with persistence-neutral words (snapshot, entity, outbox entry).
- Do not add an outbox, broker or circuit breaker ahead of a concrete need; name the need in
  the ADR (`create-adr`) when you add one.
