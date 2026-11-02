# ADR-010: Transactional Outbox in MongoDB With an In-Process Polling Relay

- **Date**: 2026-11-02
- **Status**: Accepted; running and retry superseded by [ADR-012](012-run-outbox-effects-and-scheduled-jobs-on-bullmq.md)
- **Deciders**: Felipe Boff
- **Tags**: integration, resilience, database, identity

## Context and Problem Statement

The password reset and verification e-mails went out inside the request, after the commit. A
MailerSend failure answered `422 identity.email_delivery_failed` (or, on sign-up, only logged a
`warn`) and nobody tried again; a crash between the commit and the send lost the e-mail. The
MailerSend `POST` cannot be retried inside the request because it takes no idempotency key
([ADR-007](007-retry-idempotent-outbound-calls-with-ky.md)). `NEXT-STEPS.md` already settled the
order: an outbox in Mongo first, a swappable transport later.

## Decision Drivers

- The side effect is stored in the same transaction as the data that needs it, or not at all
- A provider failure does not fail the request and does not lose the e-mail
- No new infrastructure while there is one API process and no job that needs a queue
- Two API instances never deliver the same effect at the same time
- A finished effect keeps no token and disappears on its own

## Considered Options

- Outbox collection in Mongo, relayed by a polling loop inside the API process
- Outbox relayed through MongoDB change streams
- `afterCommit` callback that sends in memory (what existed)
- Domain events on a broker (RabbitMQ) with a consumer that sends the e-mail

## Decision Outcome

Chosen option: **outbox collection in Mongo with an in-process polling relay**, because it closes
the commit-to-send gap with the transaction the use cases already run, and adds no service.

- Use cases call `Outbox.record({ type, payload })` (`src/shared/application/ports/outbox.ts`)
  inside `transactions.run`; `type` is `<module>.<effect>` (first ones:
  `identity.password_reset_email`, `identity.email_verification_email`)
- `MongoOutbox` writes to the `outbox` collection in the transaction's session, with
  `attempts`, `nextAttemptAt`, `lockedUntil`, `processedAt`, `failedAt`, `lastError` and
  `expiresAt`
- `OutboxRelay` (`src/shared/application/services`) is started by `start` after the server
  listens and stopped before Redis and Mongo close; it reserves one due effect at a time with a
  single `findOneAndUpdate` that writes `lockedUntil` = now + 30 s, polls every 1 000 ms when idle
  and right away after an effect
- A failure retries after a random wait up to `min(30 min, 30 s × 2^(attempts − 1))`; the 8th
  failure, or a type with no handler, abandons the effect; every failure and abandonment is logged
- A finished effect (processed or abandoned) loses its `payload` and gets `expiresAt` = end +
  7 days, removed by a TTL index
- Modules declare their consumers like their routes (`IdentityModule.outboxConsumers`, an
  `OutboxConsumer` per effect type: a presentation `Handler` with a TypeBox `input` that calls a
  use case); `OutboxConsumerAdapter` dispatches each payload through the `Dispatcher`, and a
  payload the schema refuses (`shared.input_invalid`) abandons the effect at once
- The handler gets the effect id in `inbound.metadata[OutboxMetadata.EFFECT_ID]` (`effect-id`),
  the key a handler with its own writes uses to skip an effect it already applied; the e-mail
  handlers do not use it

### Positive Consequences

- `POST /auth/password-reset/request` and `POST /me/email-verification` answer `204` with the
  provider down; the `422` for delivery is gone from those routes
- A crash after the commit no longer loses the e-mail
- The use cases do not know the transport; moving the relay to BullMQ or a worker changes only
  `start` and the relay

### Negative Consequences

- Delivery is at least once: a crash after the send and before `processedAt` resends the e-mail.
  Accepted for e-mails: the MailerSend `POST` takes no idempotency key, and the second copy
  carries the same link, so it does no harm
- The plain-text token sits in Mongo while the effect is pending
- Every API instance polls Mongo once per second while idle
- An abandoned effect is only visible in the log; there is no reprocessing route yet

## Pros and Cons of the Options

### Polling relay in the API process ✅ Chosen

- ✅ Scheduled retries wake up by the clock, which polling gives for free
- ✅ Reuses the replica-set transactions and the `expiresAt` TTL pattern of sessions and tokens
- ❌ Constant polling load and up to 1 s of latency before an e-mail leaves

### Change streams

- ✅ Reacts to a new effect without polling
- ❌ A retry scheduled for later still needs a clock, so polling would exist anyway
- ❌ The resume token has to be stored to survive restarts

### `afterCommit` in memory

- ✅ No storage and no loop
- ❌ The effect is lost when the process dies after the commit, and nothing retries a failure

### Domain events on RabbitMQ

- ✅ Decouples the module that publishes from the one that reacts
- ❌ A broker and a consumer for one module with nobody else listening

## Links

- [ADR-007: Retry Idempotent Outbound Calls With `ky`](007-retry-idempotent-outbound-calls-with-ky.md) - why the MailerSend `POST` is not retried inside the request
- `.specs/features/mongo-outbox/plan.md` - the persisted shape and the retry policy
- `NEXT-STEPS.md`, section 5 - BullMQ and RabbitMQ as the next transports
