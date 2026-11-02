# Mongo outbox

## Problem

The password reset and verification e-mails go out inside the request, after the commit. If
MailerSend fails or is slow, `POST /auth/password-reset/request` and `POST /me/email-verification`
answer `422 identity.email_delivery_failed` and nobody tries again; on sign-up, the failure only
becomes a `warn` (`identity.verification_email_not_sent`) and the e-mail is lost. If the process
dies between the commit and the send, the effect is lost too. Who pays: whoever forgot their
password and whoever just signed up, during a moment of provider instability, without knowing they
need to ask again. The retry of external calls (ADR-007) left the MailerSend `POST` out on
purpose: repeating it inside the request can send the e-mail twice.

There is no production evidence (the project has no real traffic yet); the item comes from
`NEXT-STEPS.md`, section 5, which already settles the order: outbox in Mongo first, swappable
transport later.

When this ships: the three use cases record the e-mail as an effect in the same transaction that
stores the token; the routes answer `204` even with MailerSend down; an in-process relay delivers
the pending effects, retries with backoff when the provider fails and gives up after a limit,
logging all of it.

## Flow

Reuses the `TransactionRunner` (the Mongo session already travels through `AsyncLocalStorage`), the
`IdentityMailer` port and its two adapters as they are, and the `expiresAt` TTL pattern of sessions
and tokens; the relay calls the same `sendPasswordReset`/`sendEmailVerification` as today.

1. `RequestPasswordResetUseCase`, `RequestEmailVerificationUseCase` and `SignUpWithEmailUseCase` (exist, `src/modules/identity/application/use-cases`) record the effect through the `Outbox` port (door 2, `src/shared/application/ports`) inside the same `transactions.run` that stores the token - the two verification flows through `EmailVerificationIssuer` (exists, `application/services`), which stores the token - and no longer call the mailer
2. the Mongo outbox adapter (door 1, `src/shared/infrastructure`) writes the effect to the `outbox` collection in the transaction's session; if the transaction aborts, the effect goes with it
3. the `OutboxRelay` (door 3, `src/shared`), started by `start` (exists, `src/app/start.ts`) after the server listens, reserves one due effect at a time (door 3) and hands it to the handler of its type
4. the identity module's outbox consumers (`identity.outbox.ts` in `presentation`, door 7, exposed by `createIdentityModule`, exists) are bound to the relay by the `OutboxConsumerAdapter` (`src/shared/presentation/outbox`), which parses the payload with the handler's TypeBox schema through the `Dispatcher` (exists) and hands it to the `SendPasswordResetEmail`/`SendEmailVerificationEmail` use cases, which call `IdentityMailer` (exists); a failure schedules a new attempt (door 4), a payload the schema refuses abandons the effect at once (door 7), a success marks `processedAt` and erases the payload (door 5)
5. out: the route answers `204`/`201` right away; the e-mail arrives when the relay delivers it; on `stop`, the relay finishes the effect in progress before the database closes (door 6)

## Impact

| Front       | What changes                                                                                                                                                                                                                                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| domain      | new term: `OutboxEffect` - a side effect recorded to run after the commit, with a `type` (`<module>.<effect>`) and a `payload`; lives in `src/shared`                                                                                                                                                                                                                                |
| domain      | new term: `Outbox` - port to record an effect inside the transaction; identity's deps receive it (`IdentityModuleDeps`, and `IdentityRuntime` for `createIdentityModule`, which also receives the process's single `Clock` from `start` instead of creating its own), and the in-memory test context (`createIdentityContext`) gains a fake (`InMemoryOutbox`, `src/shared/testing`) |
| domain      | new term: `OutboxConsumer` - ties an effect `type` to a presentation `Handler` (schema + use case), declared like an `HttpRoute`; `IdentityModule.outboxConsumers` lists identity's, and `OutboxConsumerAdapter` turns them into the relay's handlers                                                                                                                                |
| behaviour   | `POST /auth/password-reset/request` and `POST /me/email-verification` stop answering `422 identity.email_delivery_failed`; they answer `204` and the e-mail goes out later. Who reads it: the front end (`docs/auth-front-end-contract.md` cites the behaviour)                                                                                                                      |
| behaviour   | sign-up stops logging `identity.verification_email_not_sent`; a delivery failure shows up in the relay's log                                                                                                                                                                                                                                                                         |
| behaviour   | `start` now runs a polling loop every 1 000 ms while the app is up; `stop` waits for the effect in progress                                                                                                                                                                                                                                                                          |
| security    | the e-mail's plain-text token stays in Mongo while the effect is pending (door 5); today it only exists in the request's memory                                                                                                                                                                                                                                                      |
| tests       | `FakeClock` moves from identity's `testing/fakes.ts` to `src/shared/testing/fake-clock.ts` (the relay spec in `src/shared` needs it and shared cannot import a module) and starts at `faker.date.recent()` instead of a fixed date; the specs that took tokens from `FakeIdentityMailer` read them from the outbox (`recordedEmails`)                                                |
| stored data | new `outbox` collection; nothing to migrate                                                                                                                                                                                                                                                                                                                                          |
| docs        | new ADR (outbox in Mongo, in-process polling relay, swappable transport later); `docs/auth-front-end-contract.md` without the delivery `422`; `STACK.md` mentions the outbox; the `NEXT-STEPS.md` item becomes `[x]` in the sub-items done                                                                                                                                           |

## Relations

New entity: `OutboxEffect`, with no relation to other entities; it keeps a copy of the e-mail's data
and is written in the same transaction that stores the token. Constraints that do not go back:
`type` always present and in the `<module>.<effect>` format (door 2); a finished effect (delivered or
abandoned) has no `payload` (door 5) and expires 7 days later (door 1).

## Surface

| Route                               | In        | Out        | Status                     |
| ----------------------------------- | --------- | ---------- | -------------------------- |
| `POST /auth/password-reset/request` | unchanged | empty body | `204`, `400`, `429`        |
| `POST /me/email-verification`       | unchanged | empty body | `204`, `401`, `409`, `429` |

## Landing

| One-way door                                                                        | Literal shape                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Alternative rejected                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. `outbox` collection (persisted schema)                                           | `{ _id: ObjectId, type, payload: object \| null, attempts, nextAttemptAt, lockedUntil: Date \| null, processedAt: Date \| null, failedAt: Date \| null, lastError: string \| null, expiresAt: Date \| null, createdAt }`; indexes `{ processedAt: 1, failedAt: 1, nextAttemptAt: 1 }` (reservation) and `{ expiresAt: 1 }, { expireAfterSeconds: 0 }`; `expiresAt` = end + 7 days, null while pending                                                                                                                                                                                                                                                                                                | the `NEXT-STEPS.md` fields without `lockedUntil` - two API instances would take the same effect; TTL straight on `processedAt` - does not cover the abandoned ones and departs from the `expiresAt` pattern of sessions and tokens; one collection per module - the relay would have to know each one                                                                                      |
| 2. `Outbox` port and effect names (precedent)                                       | `export type Outbox = { record(effect: OutboxEffectInput): Promise<void> }` with `OutboxEffectInput = { type: string; payload: Record<string, unknown> }`, called inside `transactions.run`; types `identity.password_reset_email` and `identity.email_verification_email`                                                                                                                                                                                                                                                                                                                                                                                                                           | `afterCommit` + in-memory send (what exists) - the effect is lost if the process dies after the commit; publish a domain event (`identity.password_reset_requested`) and let a consumer decide the e-mail - needs an event bus that only makes sense with a second module (`NEXT-STEPS.md`, RabbitMQ)                                                                                      |
| 3. Polling relay with reservation (precedent)                                       | every 1 000 ms without work (right away after delivering one), `findOneAndUpdate({ processedAt: null, failedAt: null, nextAttemptAt: { $lte: now }, $or: [{ lockedUntil: null }, { lockedUntil: { $lte: now } }] }, { $set: { lockedUntil: now + 30 s } }, { sort: { nextAttemptAt: 1 } })`, one effect at a time                                                                                                                                                                                                                                                                                                                                                                                    | change streams - a scheduled retry has to wake up by the clock, which a change stream does not give, so polling would be needed anyway, and the _resume token_ would have to be stored; read and mark in two steps - two instances would deliver the same e-mail                                                                                                                           |
| 4. Retry policy                                                                     | failure: `attempts + 1`, `nextAttemptAt = now + random(0, min(30 min, 30 s × 2^(attempts − 1)))`, `lastError`, `lockedUntil = null`; on the 8th failure: `failedAt`; type with no handler: `failedAt` right away                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | retry with no limit - an impossible e-mail (refused address) would keep trying forever; fixed interval - hammers the provider when it comes back; the `ky` retry (ADR-007) - repeats only `GET` and inside the request                                                                                                                                                                     |
| 5. Token at rest                                                                    | the `payload` keeps the plain-text token only while the effect is pending; when it ends (delivered or abandoned), `payload = null`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | encrypt the `payload` with an application key - requires managing and rotating a key for data that lives minutes; keep only the hash and generate the token at send time - the token has to be the same one whose hash was already stored, so it has to exist somewhere until the send                                                                                                     |
| 6. Relay inside the API process                                                     | `start` creates the `OutboxRelay` with the modules' handlers and calls `relay.start()` after `listen`; `stop` calls `await relay.stop()` (waits for the effect in progress) before closing Redis and Mongo                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | a separate worker process - a second entry point, another image or service in compose, with no volume to justify it; it can become a worker later, because the relay is a class                                                                                                                                                                                                            |
| 7. Outbox consumers as presentation entries (precedent)                             | `export type OutboxConsumer = Entry & Readonly<{ type: string }>` (`src/shared/presentation/outbox`); each module lists them like its routes (`identity.outbox.ts`: `{ type: IdentityOutboxEffect.PASSWORD_RESET_EMAIL, handler: new SendPasswordResetEmailHandler(deps) }`); the handler declares a TypeBox `input` (`tokenEmailSchema`, `expiresAt` through `dateSchema`, a `Type.Refine` over `Type.Unsafe<Date>`) and calls a use case; `OutboxConsumerAdapter.toHandlers(consumers)` dispatches the payload through the `Dispatcher` as `Inbound { input: payload, metadata: {}, ip: "", actor: undefined }`; a payload refused with `shared.input_invalid` abandons the effect on that attempt | an application-level handler casting the payload (`payload as TokenEmail`, what the build first did) - a payload written in an older shape reaches the mailer as `undefined` fields; a typed `defineOutboxEffect<Payload>()` registry - hides the cast in one place and still validates nothing; retrying a refused payload up to the 8th attempt - the same payload is refused every time |
| 8. `dateSchema` takes a `Date` or an ISO date-time (precedent for every date input) | `Type.Codec(Type.Refine(Type.Unsafe<Date \| string>({}), (value) => value instanceof Date ? !Number.isNaN(value.getTime()) : typeof value === "string" && IsDateTime(value) && !Number.isNaN(Date.parse(value)))).Decode((value) => new Date(value))`, with `IsDateTime` from `typebox/format`; one violation `{ reason: "~refine" }` per refused field                                                                                                                                                                                                                                                                                                                                              | a `Date` only (door 7 as first built) - a JSON body or a BullMQ job carries dates as strings, so every date there would be refused; `Type.Union([date, Type.String({ format: "date-time" })])` - each refusal reports three violations for one field (`~refine`, `format`/`type`, `anyOf`); `IsDateTime` alone - accepts `23:59:60`, which `new Date` turns into an Invalid Date           |

- Nothing else in this change is hard to reverse

## Criteria

### S1: The e-mail becomes an effect recorded in the same transaction (P1)

The route no longer depends on the provider to answer.

**Acceptance Criteria**

1. WHEN a reset is requested for an e-mail with an account and a password THEN the system SHALL record an `identity.password_reset_email` effect with the e-mail's `to`, `name`, `token` and `expiresAt` in the same transaction that stores the `PasswordReset`, and SHALL NOT call the mailer during the request
2. WHEN an e-mail sign-up completes THEN the system SHALL record an `identity.email_verification_email` effect in the same transaction that stores the account, and SHALL NOT call the mailer during the request
3. WHEN `POST /me/email-verification` is called by an unverified account THEN the system SHALL record an `identity.email_verification_email` effect in the same transaction that stores the verification, and SHALL NOT call the mailer during the request
4. IF the transaction aborts after the effect is recorded THEN the system SHALL NOT keep the effect
5. WHILE MailerSend is down `POST /auth/password-reset/request` SHALL answer `204` and `POST /me/email-verification` SHALL answer `204`

**Independent test:** with a mailer that always fails, `POST /auth/password-reset/request` answers `204` and the `outbox` collection has a pending `identity.password_reset_email` effect.

### S2: The relay delivers, retries and gives up (P1)

A passing provider failure does not lose the e-mail.

**Acceptance Criteria**

6. WHEN the relay finds a due effect THEN it SHALL hand it to the handler of its type and, if the handler finishes, mark `processedAt`, erase the `payload` and set `expiresAt` to `processedAt` + 7 days
7. IF the handler fails THEN the relay SHALL add 1 to `attempts`, schedule `nextAttemptAt` for now + a random time between 0 and `min(30 min, 30 s × 2^(attempts − 1))`, keep `lastError`, release the reservation and log `warn` `shared.outbox_effect_failed` with `id`, `type`, `attempts` and the error
8. IF the 8th attempt fails THEN the relay SHALL mark `failedAt`, erase the `payload`, set `expiresAt` to `failedAt` + 7 days and log `error` `shared.outbox_effect_abandoned` with `id`, `type` and `attempts`
9. IF the effect has a `type` with no handler THEN the relay SHALL mark it as abandoned on the first attempt and log `shared.outbox_effect_abandoned`
10. The relay SHALL reserve an effect only when `processedAt` and `failedAt` are null, `nextAttemptAt` has passed and `lockedUntil` is null or has passed, writing `lockedUntil` = now + 30 s in the same operation: two relays running together deliver each effect once
11. WHEN the relay finds no due effect THEN it SHALL wait 1 000 ms before looking again; WHEN it delivers one THEN it SHALL look for the next without waiting
12. WHEN the app starts THEN the relay SHALL begin after the server listens; WHEN the app stops THEN the relay SHALL finish the effect in progress and stop before Mongo closes

**Independent test:** with a mailer that fails once and then works, the relay leaves the effect with `attempts: 1` and, on the next pass after `nextAttemptAt`, with `processedAt` and no `payload`.

### S3: Identity's handlers send the right e-mail (P1)

The e-mail that arrives is the same one the request would have sent.

**Acceptance Criteria**

13. WHEN the relay delivers an `identity.password_reset_email` THEN the handler SHALL call `IdentityMailer.sendPasswordReset` with the recorded `to`, `name`, `token` and `expiresAt`
14. WHEN the relay delivers an `identity.email_verification_email` THEN the handler SHALL call `IdentityMailer.sendEmailVerification` with the recorded `to`, `name`, `token` and `expiresAt`
15. IF the token's `expiresAt` has already passed when the effect is delivered THEN the handler SHALL NOT send the e-mail, SHALL finish without error (the effect becomes `processedAt`) and SHALL log `info` `identity.email_expired_before_delivery` with the `type`

**Independent test:** a recorded `identity.password_reset_email` effect makes the `LogIdentityMailer` log the link with the same token.

### S4: The outbox cleans itself (P2)

Finished effects do not pile up nor keep a token.

**Acceptance Criteria**

16. The system SHALL keep on the `outbox` collection a TTL index on `expiresAt` with `expireAfterSeconds: 0`, so Mongo deletes the effect 7 days after it finishes
17. The system SHALL NOT keep a `payload` on a delivered or abandoned effect

**Independent test:** after delivery, the effect has `payload: null` and `expiresAt` 7 days ahead, and the collection has the `expiresAt_1` index with `expireAfterSeconds: 0`.

## Out of scope

| Excluded                                                           | Why                                                                                                                   |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| invitation, e-mail change and e-mail-changed notice via the outbox | `NEXT-STEPS.md` defines reset and verification as the first use; the other three follow the same path in a next slice |
| BullMQ as the relay's transport                                    | there is no scheduled or heavy job today; it comes in when there is (`NEXT-STEPS.md`, section 5)                      |
| RabbitMQ and domain events                                         | only with a second module that needs to listen                                                                        |
| screen or route to reprocess abandoned effects                     | the log shows the abandonment; reprocessing becomes its own item when there are operations                            |
| e-mail with no guaranteed duplicate                                | delivery is "at least once": a crash after the send and before marking `processedAt` resends the e-mail               |

## Assumptions

| Assumption                      | Chosen default                                                                    | Rationale                                                                                                             | Confirmed? |
| ------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------- |
| outbox alone or with BullMQ     | alone: the relay delivers the e-mails itself                                      | recommendation already made in the conversation; the user approved the plan                                           | y          |
| where the relay and outbox live | `src/shared` (port, Mongo adapter and relay); the handlers in the identity module | the mechanism is the same for any module; shared does not import modules, and `start` wires the handlers to the relay | y          |
| e-mail duplicate                | accepted (at least once)                                                          | the MailerSend adapter sends no idempotency key; a crash in the seconds between send and marking is rare              | y          |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface                                 | Decision              | Landing                                                                       |
| --------------------------------------- | --------------------- | ----------------------------------------------------------------------------- |
| API `POST /auth/password-reset/request` | error shape and codes | AC 5; existing - `HttpErrorMapper` problem details for `400` and `429`        |
| API `POST /me/email-verification`       | error shape and codes | AC 5; existing - problem details for `401`, `409` and `429`                   |
| both routes                             | who may call it       | existing - public (reset) and authenticated (verification), no change         |
| both routes                             | rate limits           | existing - current `RateLimitPolicy`, no change                               |
| both routes                             | versioning            | n/a - the API is not versioned; the contract only changes by losing the `422` |
| both routes                             | response shape        | existing - empty body with `204`                                              |

## Sources

- `NEXT-STEPS.md`, section 5 - "Outbox no Mongo (sem broker)" and the agreed order
- `docs/adr/007-retry-idempotent-outbound-calls-with-ky.md` - the MailerSend `POST` was left without retry because it is not idempotent
