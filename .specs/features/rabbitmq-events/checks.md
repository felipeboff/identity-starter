# RabbitMQ events checks

Profile: light
Plan: `.specs/features/rabbitmq-events/plan.md`

27 checks in 3 slices · 10 one-way doors · 0 open, of which 0 block

## Checks

Grouped by the plan's slices; numbering runs across the whole feature.

### S1 - Identity publishes `identity.account.registered`

**C1** - An e-mail sign-up records, in the account's transaction, an `identity.account.registered` event with `accountId`, `email`, `name` and `registeredVia` = `sign_up` (AC 1, door 6)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/sign-up-with-email.use-case.spec.ts -t "publishes identity.account.registered"`

**C2** - An OAuth sign-in that creates the account records the same event with `registeredVia` = `oauth` (AC 2)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/sign-in-with-oauth.use-case.spec.ts -t "publishes identity.account.registered for a new account"`

**C3** - An OAuth sign-in into an existing account records no `identity.account.registered` event (AC 3)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/sign-in-with-oauth.use-case.spec.ts -t "does not publish identity.account.registered for an existing account"`

**C4** - An accepted invitation records the same event with `registeredVia` = `invitation` (AC 4)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/accept-invitation.use-case.spec.ts -t "publishes identity.account.registered"`

**C5** - An event published in a transaction that aborts is not kept, and a committed one is stored with `kind` = `event` and its name as `type`, in every outbox store (AC 5, door 2)
Proof: `pnpm exec vitest run src/shared/testing/in-memory-outbox.spec.ts src/shared/infrastructure/mongo/mongo-outbox.integration.spec.ts -t "event"`

**C6** - The relay sends a due event to the `EventBroker` and, only after it resolves, writes `processedAt`, erases the payload and writes `expiresAt` = `processedAt` + 7 days (AC 6, door 3)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "publishes a due event and marks it processed once the broker confirms"`

**C7** - `RabbitEventBroker.send` puts the event on the `<APP_NAME>.events` exchange with routing key = the name, `messageId` = the entry id, `type` = the name, `persistent`, `contentType: application/json` and the payload as JSON, and resolves once the broker confirms (AC 6, door 1)
Proof: `pnpm exec vitest run src/shared/infrastructure/messaging/rabbit-event-broker.integration.spec.ts -t "publishes the event on the events exchange with its id and name"`

**C8** - When the publish fails, the relay logs `error` `shared.outbox_relay_failed`, leaves the event pending and publishes it again once the 30 s reservation passes; a publish with the broker away fails instead of waiting (AC 7, door 3)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "leaves the event pending when the broker refuses it"`
Proof: `pnpm exec vitest run src/shared/infrastructure/messaging/rabbit-event-broker.integration.spec.ts -t "fails a publish when the broker is away"`

**C9** - The relay hands an event only to the `EventBroker` and an effect only to the `OutboxQueue`, and an outbox entry stored with no `kind` is reserved as an effect (AC 8, door 2)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "hands an effect to the queue, never to the broker"`
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-outbox.integration.spec.ts -t "reserves an entry stored with no kind as an effect"`

**C10** - With the app running, an e-mail sign-up makes a message carrying the new account's `accountId` reach a test queue bound to `identity.account.registered` (S1 independent test)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "publishes identity.account.registered when an account signs up"`

**C27** - `Outbox.publishAll` stores every message it gets, each with its own `kind`, `type` and payload, pending and due at once; an empty list stores nothing; messages published together in a transaction that aborts are all dropped; and the Mongo outbox refuses the whole list when one `type` is outside the format (door 10)
Proof: `pnpm exec vitest run src/shared/testing/in-memory-outbox.spec.ts src/shared/infrastructure/mongo/mongo-outbox.integration.spec.ts -t "published together|empty list"`

**C11** - Identity's `public.ts` exposes the `identity.account.registered` name, and its module declares no `MessageConsumer` yet (door 6)
Proof: `pnpm exec vitest run src/modules/identity/public.spec.ts -t "exposes the account registered event"`

### S2 - A module subscribes to an event

**C12** - Setting up the subscribers declares the `<APP_NAME>.events` topic exchange, the `<APP_NAME>.dead` queue and, per `MessageConsumer`, the quorum queue `<APP_NAME>.<handler.name>` bound to the event name (AC 9, door 1)
Proof: `pnpm exec vitest run src/shared/infrastructure/messaging/rabbit-message-consumers.integration.spec.ts -t "declares the exchange, the dead-letter queue and each subscriber's queues"`

**C13** - A message reaches its handler through the `Dispatcher` with the payload as `input` and the `messageId` in `metadata["event-id"]`, and is acknowledged once the handler finishes (AC 10, door 4)
Proof: `pnpm exec vitest run src/shared/presentation/messaging/message-consumer-adapter.spec.ts -t "dispatches the payload to the handler with the event id"`
Proof: `pnpm exec vitest run src/shared/infrastructure/messaging/rabbit-message-consumers.integration.spec.ts -t "hands a message to its handler and acknowledges it"`

**C14** - Two subscribers of the same event each get their own copy (AC 11)
Proof: `pnpm exec vitest run src/shared/infrastructure/messaging/rabbit-message-consumers.integration.spec.ts -t "gives each subscriber its own copy"`

**C15** - The same event delivered twice to one subscriber runs its handler once, and the second delivery is acknowledged without running it (AC 12, door 5)
Proof: `pnpm exec vitest run src/shared/application/services/message-runner.spec.ts -t "runs a duplicate delivery only once"`
Proof: `pnpm exec vitest run src/shared/infrastructure/messaging/rabbit-message-consumers.integration.spec.ts -t "acknowledges a duplicate without running the handler again"`

**C16** - A handler failing with an `AppError` - a payload its schema refuses included - is acknowledged with no other delivery and logged `warn` `shared.message_refused` with `event`, `consumer`, `id` and the code (AC 13, door 4)
Proof: `pnpm exec vitest run src/shared/application/services/message-runner.spec.ts -t "refuses a message its handler rejects with an AppError"`
Proof: `pnpm exec vitest run src/shared/presentation/messaging/message-consumer-adapter.spec.ts -t "refuses a payload outside the consumer's schema"`
Proof: `pnpm exec vitest run src/shared/infrastructure/messaging/rabbit-message-consumers.integration.spec.ts -t "acknowledges a refused message without another delivery"`

**C17** - A handler failing with any other error before its 5th attempt republishes a copy to the subscriber's queue with `x-attempt` one higher (absent = 1) and acknowledges the original, logged `warn` `shared.message_failed` with `event`, `consumer`, `id`, `attempts` and the error (AC 14, door 4)
Proof: `pnpm exec vitest run src/shared/application/services/message-runner.spec.ts -t "asks for a retry before the 5th failure"`
Proof: `pnpm exec vitest run src/shared/infrastructure/messaging/rabbit-message-consumers.integration.spec.ts -t "redelivers a failed message with the next attempt number"`

**C18** - A failure on the 5th attempt sends the message to `<APP_NAME>.dead` with the same `messageId`, acknowledges it and logs `error` `shared.message_dead_lettered` with `event`, `consumer` and `id`; a handler that always fails runs exactly 5 times (AC 15, S2 independent test)
Proof: `pnpm exec vitest run src/shared/application/services/message-runner.spec.ts -t "dead-letters the message on its 5th failure"`
Proof: `pnpm exec vitest run src/shared/infrastructure/messaging/rabbit-message-consumers.integration.spec.ts -t "moves a message to the dead-letter queue after 5 failures"`

**C19** - A handler that fails leaves no inbox entry, so the next delivery runs it again (AC 16, door 5)
Proof: `pnpm exec vitest run src/shared/application/services/message-runner.spec.ts -t "keeps no inbox entry when the handler fails"`

**C20** - Every inbox records an entry once per subscriber and event id (the second record answers false), drops one recorded in a transaction that aborts, and the Mongo inbox has the unique `{ consumer, eventId }` index and the TTL on `expiresAt` (door 5)
Proof: `pnpm exec vitest run src/shared/testing/in-memory-inbox.spec.ts src/shared/infrastructure/mongo/mongo-inbox.integration.spec.ts -t "inbox"`

**C25** - A `run` called inside another runs in the outer transaction, in both runners: its writes are undone when the outer one fails, and its `afterCommit` callbacks run only after the outer commit (door 9)
Proof: `pnpm exec vitest run src/shared/testing/in-memory-transaction-runner.spec.ts src/shared/infrastructure/mongo/mongo-transaction-runner.integration.spec.ts -t "joins the outer transaction"`

**C26** - A subscriber whose handler opens its own `transactions.run` keeps its write and the inbox entry together, and a failure after that write drops both (AC 17, door 9)
Proof: `pnpm exec vitest run src/shared/application/services/message-runner.spec.ts -t "keeps the handler's writes and the inbox entry in one transaction"`

### S3 - The app connects to and disconnects from RabbitMQ

**C21** - With RabbitMQ unreachable at boot, `start` rejects with `shared.broker_unavailable`, does not listen and closes Redis and the database (AC 18, door 8)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "does not listen when RabbitMQ is unavailable, and closes Redis and the database"`

**C22** - `stop` stops the relay, then the subscribers, the BullMQ workers and queues and the RabbitMQ connection, and only then Redis and Mongo; a subscriber closes only after the message it is running finishes (AC 19, door 8)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "closes the relay, the subscribers and RabbitMQ before Redis and Mongo"`
Proof: `pnpm exec vitest run src/shared/infrastructure/messaging/rabbit-message-consumers.integration.spec.ts -t "waits for the message in progress before it closes"`

**C23** - After the broker drops the connection, the subscriber consumes again and a message published afterwards reaches its handler; the connection logs `warn` `shared.broker_disconnected` and `info` `shared.broker_connected` (AC 20, S3 independent test)
Proof: `pnpm exec vitest run src/shared/infrastructure/messaging/rabbit-message-consumers.integration.spec.ts -t "consumes again after the connection drops"`
Proof: `pnpm exec vitest run src/shared/infrastructure/messaging/rabbit-connection.integration.spec.ts -t "logs when the connection drops and comes back"`

**C24** - `RABBITMQ_URL` is required and must be an `amqp://` or `amqps://` URL (door 8)
Proof: `pnpm exec vitest run src/app/config.spec.ts -t "RABBITMQ_URL"`

## Coverage

| Set (size)                                            | Member -> proof                                                                                                                                      | Unproven |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| ways an account is created (3)                        | sign-up C1 · OAuth new account C2 · invitation C4                                                                                                    | -        |
| OAuth sign-in outcomes for the event (2)              | new account C2 · existing account C3                                                                                                                 | -        |
| outbox entry kinds at the relay (3)                   | event C6, C9 · effect C9 · no kind C9                                                                                                                | -        |
| message properties of a published event (6)           | routing key C7 · `messageId` C7 · `type` C7 · `persistent` C7 · `contentType` C7 · JSON payload C7                                                   | -        |
| subscriber outcomes for one delivery (5)              | handled C13 · duplicate C15 · `AppError` C16 · other error before the 5th C17 · 5th failure C18                                                      | -        |
| outbox stores storing events (2)                      | in-memory C5, C27 · Mongo C5, C9, C27                                                                                                                | -        |
| inbox stores (2)                                      | in-memory C20 · Mongo C20                                                                                                                            | -        |
| startup config: broker, bus and subscribers (1 place) | `start` C10, C21, C22                                                                                                                                | -        |
| Landing doors (10)                                    | 1 C7, C12, C18 · 2 C5, C9 · 3 C6, C8, C9 · 4 C13, C16, C17, C18 · 5 C15, C19, C20 · 6 C1, C11 · 7 C7 · 8 C21, C22, C24 · 9 C25, C26 · 10 C6, C7, C27 | -        |

- Claims naming a log event, a field value, a queue argument or a message property: C1, C2, C4, C6, C7, C12, C16, C17, C18, C23 - each has a proof that asserts that value
- No other check claims more than the single case its proof exercises

## Swept

- validation: C16 (a payload the schema refuses is acknowledged and logged), C24 (`RABBITMQ_URL` format)
- failure modes: C8, C17, C18, C21
- idempotency: C15 (inbox per subscriber and event id), C20 (unique index)
- authorization: n/a - no route; the exchange and queues are reached only by the API process on the internal network
- concurrency: C14 (each subscriber gets its own copy), C15 (two deliveries of one event run once)
- data lifecycle: C6 (a published event loses its payload and expires in 7 days), C20 (inbox entries expire in 7 days)
- dependency failure: C8 (broker away at publish), C21 (broker away at boot), C23 (connection drops)
- state transitions: C6 (pending -> processed), C17 and C18 (delivered -> retried -> dead-lettered)
- observability: C16, C17, C18, C23

## Handoff

- Existing files touched (outbox ports, relay, Mongo and in-memory outbox with their contract and specs, log events, shared errors, consumer adapter, boundary spec, config, `start` and its e2e spec, vitest config and global setup, the three identity use cases with their specs, identity's `public.ts`, module and context, compose, `.env.example`) = 146 210 bytes / 4 ≈ 37k, plus about 25k of new files (event bus, inbox and message ports, message runner, Mongo and in-memory inbox with contract, RabbitMQ connection, event bus and subscribers with specs, `MessageConsumer` and its adapter, the RabbitMQ global setup) ≈ 62k in total, under the 150k budget - one builder
- **Boundary:** C1-C26 closed in one builder (uncommitted, awaiting the user's review); `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test:coverage`, `pnpm test:unit:coverage`, `pnpm test:integration:coverage` and `pnpm test:e2e:coverage` (strict route statuses) all exit 0, every coverage run at 100%
- **Settled mid-build:** a probe showed that on RabbitMQ 4 a requeued `nack` does not count toward `x-delivery-limit`, so the user chose to count the attempts in an `x-attempt` header of our own with no retry queue (door 1, door 4); the inbox shares the subscriber's transaction, which a nested `transactions.run` refused, so the user chose that the inner run joins the outer one (door 9, C25, C26). The user staged `amqplib ^2.2.1` in `package.json`, not the `2.2.0` door 1 names. Found while building: each `MongoTransactionRunner` keeps its open transaction in its own `AsyncLocalStorage`, so `start` now creates the one runner and hands it to identity through `IdentityRuntime.transactions` (otherwise AC 17 fails in production while C26 passes in memory); the Mongo inbox records with an upsert (`$setOnInsert`) instead of catching the duplicate key, because a duplicate key aborts the transaction it happens in; a message that finishes after its channel closed is neither acknowledged nor forwarded (the broker already requeued it), because an `ack` on the new channel with the old delivery tag closes that channel; both channels log `shared.broker_channel_failed` instead of leaving an `error` with no listener (an unhandled rejection at `stop`); `start` waits for the events channel before starting the relay; a dead-lettered message carries an `x-consumer` header naming the subscriber that gave up; a message whose content is not JSON reaches the handler as text, so its schema refuses it. Extra log events: `shared.broker_connection_failed`, `shared.broker_channel_failed`, `shared.message_unsettled`
- **Abandoned:** `nack` with `x-delivery-limit: 5` and the per-subscriber retry queue with a 10 s TTL (both replaced by the `x-attempt` header); listing connections through the management API to drop them in tests (it lags about 5 s), replaced by a broker user per suite whose connections the API closes at once
- **Settled after the build:** the user found `record` and `publish` too alike and asked for one method: `Outbox.publish(message)` with an explicit `kind`, plus `publishAll`, over one generic `OutboxMessage<TKind, TType, TPayload>` whose `type` replaces the event's `name`; the relay's port kept its role and became `EventBroker.send` (first named `EventBus.publish`). Landing door 10 records it, C27 proves `publishAll`, and C6, C7 and C9 name the port and the class as they are now. The two e-mail effects now call `publish` with `kind: "effect"`; the sign-up spec checks the e-mail and the event apart in the one `publish` spy
