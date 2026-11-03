# ADR-013: Publish Events Between Modules on RabbitMQ from the Outbox

- **Date**: 2026-11-02
- **Status**: Accepted
- **Deciders**: Felipe Boff
- **Tags**: integration, events, resilience, rabbitmq

## Context and Problem Statement

The outbox ([ADR-010](010-transactional-outbox-in-mongo-with-an-in-process-relay.md),
[ADR-012](012-run-outbox-effects-and-scheduled-jobs-on-bullmq.md)) only carries orders a module
runs itself. A module had no way to announce a fact to the others: a second module reacting to a
sign-up would have needed identity to call it directly and know every interested party.
`STACK.md` already chose RabbitMQ for events between modules.

## Decision Drivers

- An event is born in the transaction that causes it, so none is lost between the commit and the
  broker
- The publisher knows no subscriber; each subscriber gets its own copy and runs it once
- A failing subscriber neither blocks the others nor loses the event
- A subscriber's writes and its record of the event commit together

## Considered Options

- Mongo outbox entries of kind `event`, relayed to a RabbitMQ topic exchange
- Publish on RabbitMQ right after the commit, with no outbox
- Redis Streams, already in the stack
- Retry with `nack` and the quorum queue `x-delivery-limit`

## Decision Outcome

Chosen option: **Mongo outbox entries of kind `event`, relayed to a RabbitMQ topic exchange**,
because it keeps the outbox guarantee and lets RabbitMQ fan out and keep the messages.

- Use cases write effects and events with the same `Outbox.publish` (or `publishAll`), naming the
  `kind` of each `OutboxMessage` (an entry stored with no kind is an effect); the relay hands an
  event to the `EventBroker` port, which sends it on a confirm channel to `<APP_NAME>.events` with
  its `type` as routing key and the entry id as `messageId`, and marks it processed once the
  broker confirms
- A module declares a `MessageConsumer` (`Entry` + `event`) like a route; each gets a quorum queue
  `<APP_NAME>.<handler.name>` bound to its event
- The subscriber records `{ consumer, eventId }` in a Mongo `inbox` (unique, 7-day TTL) and runs
  the handler in one transaction; a duplicate is acknowledged without running it
- A business refusal (`AppError`) is acknowledged and logged; any other failure republishes a copy
  with header `x-attempt` + 1, and the 5th failure goes to `<APP_NAME>.dead`
- A `transactions.run` inside another joins it, so the handler's use case commits with the inbox
  entry; modules share the process's one `TransactionRunner`
- The API does not start without RabbitMQ (`RABBITMQ_URL`), and reconnects while it runs

### Positive Consequences

- Identity publishes `identity.account.registered` without knowing who listens
- A crash anywhere repeats a delivery at most, and the inbox absorbs it

### Negative Consequences

- The 5 attempts follow each other in milliseconds, so they barely help with a passing outage
- One more service to run, and integration tests need Docker (Testcontainers)
- An event waits up to the 30 s reservation when the broker refuses it
- The dead-letter queue is drained by hand, through the management UI

## Pros and Cons of the Options

### Outbox events relayed to RabbitMQ ✅ Chosen

- ✅ No event lost between commit and broker; fan-out and durability from RabbitMQ
- ❌ At-least-once delivery, so every subscriber needs the inbox

### Publish after the commit, no outbox

- ✅ One hop less
- ❌ A crash between the commit and the publish loses the event

### Redis Streams

- ✅ Already running
- ❌ Consumer groups, retry and dead letters written by hand; `STACK.md` chose RabbitMQ

### `nack` with `x-delivery-limit`

- ✅ No code to count attempts
- ❌ On RabbitMQ 4 a requeued `nack` does not count: a probe saw 1085 deliveries and no dead letter

## Links

- Extends [ADR-010](010-transactional-outbox-in-mongo-with-an-in-process-relay.md) and
  [ADR-012](012-run-outbox-effects-and-scheduled-jobs-on-bullmq.md); applies the
  `MessageConsumer` of [ADR-001](001-transport-neutral-handler-layer.md)
- `.specs/features/rabbitmq-events/plan.md` - the literal shapes (Landing doors 1-9)
