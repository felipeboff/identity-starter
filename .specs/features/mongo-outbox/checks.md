# Mongo outbox checks

Profile: light
Plan: `.specs/features/mongo-outbox/plan.md`

31 checks in 4 slices · 8 one-way doors · 0 open, of which 0 block

## Checks

Grouped by the plan's slices; numbering runs across the whole feature.

### S1 - The e-mail becomes an effect recorded in the same transaction · 16 files · 150 KB · ~38k

**C1** - `RequestPasswordResetUseCase` records exactly one effect `{ type: "identity.password_reset_email", payload: { to, name, token, expiresAt } }` with `expiresAt` = now + `PASSWORD_RESET_TTL_MS` and a `token` whose hash is the stored `PasswordReset`'s, and `FakeIdentityMailer.passwordResets` stays `[]` (AC 1)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/request-password-reset.use-case.spec.ts -t "records the reset e-mail in the outbox instead of sending it"`

**C2** - `Outbox.record` is called while `transactions.isRunning()` is `true`, with the new `PasswordReset` already saved in that transaction (AC 1)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/request-password-reset.use-case.spec.ts -t "records the e-mail inside the transaction that stores the reset"`

**C3** - `SignUpWithEmailUseCase` records exactly one `identity.email_verification_email` effect with the account's `to` and `name`, `expiresAt` = now + `EMAIL_VERIFICATION_TTL_MS` and the stored verification's token; `record` runs while the transaction is running, after the account is saved; `FakeIdentityMailer.emailVerifications` stays `[]` (AC 2)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/sign-up-with-email.use-case.spec.ts -t "records the verification e-mail in the outbox instead of sending it"`
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/sign-up-with-email.use-case.spec.ts -t "records the e-mail inside the sign-up transaction"`

**C4** - `RequestEmailVerificationUseCase` records exactly one `identity.email_verification_email` effect with `to`, `name`, `token` and `expiresAt` = now + `EMAIL_VERIFICATION_TTL_MS`; `record` runs while the transaction is running, after the verification is saved; `FakeIdentityMailer.emailVerifications` stays `[]` (AC 3)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/request-email-verification.use-case.spec.ts -t "records the verification e-mail in the outbox instead of sending it"`
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/request-email-verification.use-case.spec.ts -t "records the e-mail inside the transaction that stores the verification"`

**C5** - An effect recorded inside `transactions.run` whose work then throws is not reserved and not stored, both in the in-memory outbox and in the Mongo outbox (AC 4)
Proof: `pnpm exec vitest run src/shared/testing/in-memory-outbox.spec.ts src/shared/infrastructure/mongo/mongo-outbox.integration.spec.ts -t "drops an effect recorded in a transaction that aborts"`

**C6** - With `sendPasswordReset` and `sendEmailVerification` rejecting with `identity.email_delivery_failed`, `POST /auth/password-reset/request` answers `{ status: 204 }` and the outbox holds one pending `identity.password_reset_email` effect to that address, and `POST /me/email-verification` answers `{ status: 204 }` with one pending `identity.email_verification_email` effect (AC 5)
Proof: `pnpm exec vitest run src/modules/identity/presentation/identity.failures.e2e.spec.ts -t "answers 204 while the e-mail provider is down"`

**C7** - `POST /auth/password-reset/request` declares failures `[400, 429]` and `POST /me/email-verification` declares `[401, 409, 429]`, and the strict route × status matrix finds every declared status answered by an e2e test and no undeclared one (Surface)
Proof: `ROUTE_STATUSES=strict pnpm exec vitest run --project e2e`

**C8** - Through `createIdentityModule` with the log mailer, a reset request writes one `outbox` entry `{ type: "identity.password_reset_email", attempts: 0, processedAt: null, payload.to: <address> }` and logs no `identity.email_logged` during the request (AC 1, AC 5 independent test)
Proof: `pnpm exec vitest run src/modules/identity/identity.module.integration.spec.ts -t "logs the password reset link when the relay delivers the effect"`

### S2 - The relay delivers, retries and gives up · 12 files · 70 KB · ~18k

**C9** - Given a due effect, `relayNext()` calls the handler of its `type` once with the recorded payload, resolves `true`, and the effect ends with `processedAt` = now, `payload: null`, `expiresAt` = now + 604 800 000 ms (7 days) and `lockedUntil: null` (AC 6)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "hands a due effect to the handler of its type and marks it processed"`

**C10** - When the handler rejects on the 1st attempt, the effect ends with `attempts: 1`, `nextAttemptAt` = now + 15 000 ms (`Math.random` = 0.5), `lastError` = the error's message, `lockedUntil: null`, the payload kept and `processedAt`/`failedAt` null, and one `warn` `shared.outbox_effect_failed` `{ id, type, attempts: 1, error }` is logged (AC 7)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "schedules a new attempt and logs a warning when the handler fails"`

**C11** - With `Math.random` = 0.5, the failure that makes `attempts` 1, 2, 3, 4, 5, 6, 7 schedules `nextAttemptAt` at now + 15 000, 30 000, 60 000, 120 000, 240 000, 480 000, 900 000 ms (the 7th capped at 30 min); with `Math.random` = 0.999 999 the 1st wait is 29 999 ms (AC 7)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "waits a random share of min(30 min, 30 s × 2^(attempts − 1)) after failure"`
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "never waits the whole backoff"`

**C12** - When the handler rejects on an effect with `attempts: 7`, the effect ends with `attempts: 8`, `failedAt` = now, `payload: null`, `expiresAt` = now + 604 800 000 ms, `lockedUntil: null`, `lastError` set, and one `error` `shared.outbox_effect_abandoned` `{ id, type, attempts: 8 }` is logged with no `warn` (AC 8)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "abandons the effect when the 8th attempt fails"`

**C13** - An effect whose `type` has no handler ends on its 1st reservation with `attempts: 1`, `failedAt` = now, `payload: null`, `expiresAt` = now + 7 days, and one `error` `shared.outbox_effect_abandoned` `{ id, type, attempts: 1 }` is logged (AC 9)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "abandons an effect whose type has no handler"`

**C14** - `reserve({ now, lockedUntil })` returns a pending effect whose `nextAttemptAt` ≤ now and whose `lockedUntil` is null or ≤ now, writing `lockedUntil`; it returns `null` for a processed effect, a failed effect, an effect due 1 ms after now and an effect locked until 1 ms after now; it returns the effect again once its lock is ≤ now; with two due effects it returns the one with the earlier `nextAttemptAt` - in-memory and Mongo (AC 10)
Proof: `pnpm exec vitest run src/shared/testing/in-memory-outbox.spec.ts src/shared/infrastructure/mongo/mongo-outbox.integration.spec.ts -t "reserve"`

**C15** - The relay reserves with `lockedUntil` = now + 30 000 ms: while the handler runs, the stored effect's `lockedUntil` is now + 30 000 ms (AC 10)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "locks the effect it takes for 30 s"`

**C16** - Against Mongo, 2 concurrent `reserve` calls on one due effect return it exactly once (one effect, one `null`) (AC 10)
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-outbox.integration.spec.ts -t "two relays reserving at the same time take an effect once"`

**C17** - After `start()`, with nothing due, `reserve` is called once, still once at 999 ms and twice at 1 000 ms; with an effect due, the second `reserve` happens without advancing the timers (AC 11)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "waits 1 000 ms before looking again when nothing is due"`
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "looks for the next effect right after relaying one"`

**C18** - `stop()` called while a handler is running resolves only after the handler settles, with the effect marked processed and no further `reserve`; `stop()` called while idle resolves without advancing the timers (AC 12)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "finishes the effect in progress before stop resolves"`
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "stops while idle without waiting for the next look"`

**C19** - In the app built by `start`, `OutboxRelay.start` runs after `shared.server_started` is logged, and on `stop()` the relay's `stop` has resolved before `MongoDatabase.close` is called (AC 12)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "starts the outbox relay after listening and stops it before closing the database"`

**C20** - In the app built by `start`, a sign-up and a password reset request write `outbox` entries `{ type: "identity.email_verification_email" }` and `{ type: "identity.password_reset_email" }` that the running relay, through identity's consumers, turns into `processedAt` set and `payload: null`, with `identity.email_logged` logged once per e-mail (AC 2, AC 6, startup config, Landing door 7)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "delivers the e-mails recorded in the outbox while it runs"`

**C21** - Through `createIdentityModule` with the MailerSend mailer, a `fetch` answering `503` then `202` is not called during the request; the first `relayNext()` leaves the entry with `attempts: 1`, `lastError: "identity.email_delivery_failed"` and the payload kept; after the clock passes `nextAttemptAt`, the second leaves `processedAt` set and `payload: null`, with 2 calls to `fetch` (S2 independent test)
Proof: `pnpm exec vitest run src/modules/identity/identity.module.integration.spec.ts -t "retries the MailerSend delivery after a failure"`

**C22** - When `reserve` rejects, the relay logs `error` `shared.outbox_relay_failed` `{ error }` and calls `reserve` again 1 000 ms later (Swept: dependency failure)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "logs and keeps polling when the store fails"`

### S3 - Identity's consumers send the right e-mail · 14 files · 45 KB · ~12k

Renegotiated after review: the user asked for the payload to go through a handler with a schema and a use case, like an HTTP route (Landing door 7), instead of an application handler that cast the payload. C23-C25 keep their claims and move to the use cases; C29-C30 are new.

**C23** - `SendPasswordResetEmailUseCase` calls `sendPasswordReset` once with exactly the given `{ to, name, token, expiresAt }` and nothing else on the mailer (AC 13)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/send-password-reset-email.use-case.spec.ts -t "sends the password reset e-mail with the recorded fields"`

**C24** - `SendEmailVerificationEmailUseCase` calls `sendEmailVerification` once with exactly the given `{ to, name, token, expiresAt }` and nothing else on the mailer (AC 14)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/send-email-verification-email.use-case.spec.ts -t "sends the verification e-mail with the recorded fields"`

**C25** - With now = `expiresAt` and with now after it, each use case sends nothing, resolves, and logs one `info` `identity.email_expired_before_delivery` `{ type }` with its effect type; with now = `expiresAt` − 1 ms it sends (AC 15)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/send-password-reset-email.use-case.spec.ts src/modules/identity/application/use-cases/send-email-verification-email.use-case.spec.ts -t "skips an e-mail whose token expired before delivery"`
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/send-password-reset-email.use-case.spec.ts src/modules/identity/application/use-cases/send-email-verification-email.use-case.spec.ts -t "still sends an e-mail 1 ms before its token expires"`

**C29** - `OutboxConsumerAdapter.toHandlers` gives one handler per consumer `type`; handling a payload dispatches it to that consumer's handler decoded by its `input` schema (a `Date` stays a `Date`, unknown fields dropped); a payload outside the schema rejects with `shared.input_invalid` and the handler is not called (Landing door 7)
Proof: `pnpm exec vitest run src/shared/presentation/outbox/outbox-consumer-adapter.spec.ts -t "dispatches the payload to the consumer of its type, decoded by its schema"`
Proof: `pnpm exec vitest run src/shared/presentation/outbox/outbox-consumer-adapter.spec.ts -t "refuses a payload outside the consumer's schema"`
Proof: `pnpm exec vitest run src/shared/presentation/date.schema.spec.ts -t "keeps a valid Date and refuses anything else"`

**C30** - When the handler rejects with `shared.input_invalid` on an effect with `attempts: 0`, the effect ends with `attempts: 1`, `failedAt` = now, `payload: null`, `lastError: "shared.input_invalid"`, and one `error` `shared.outbox_effect_abandoned` is logged (Landing door 7)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "abandons at once an effect whose payload its consumer refuses"`

**C26** - Relaying the reset effect of C8 through `createIdentityModule` logs `identity.email_logged` with a `link` containing the recorded token, and the entry ends with `processedAt` set, `payload: null` and `expiresAt` = `processedAt` + 7 days (S3 and S4 independent tests)
Proof: `pnpm exec vitest run src/modules/identity/identity.module.integration.spec.ts -t "logs the password reset link when the relay delivers the effect"`

### S4 - The outbox cleans itself · 4 files · 20 KB · ~5k

**C27** - The Mongo `outbox` collection has the index `expiresAt_1` with `expireAfterSeconds: 0` and the index `{ processedAt: 1, failedAt: 1, nextAttemptAt: 1 }`; a recorded effect is stored as `{ _id: ObjectId, type, payload, attempts: 0, nextAttemptAt: createdAt, lockedUntil: null, processedAt: null, failedAt: null, lastError: null, expiresAt: null, createdAt }` with no other field; a `type` outside `<module>.<effect>` is refused with a `ValidationError` and nothing is stored (AC 16, door 1, door 2)
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-outbox.integration.spec.ts -t "creates the reservation and the TTL indexes"`
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-outbox.integration.spec.ts -t "stores a recorded effect with the outbox shape"`
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-outbox.integration.spec.ts -t "refuses a type outside the <module>.<effect> format"`

**C28** - `markProcessed` and `markFailed` leave `payload: null`, `lockedUntil: null` and the given `processedAt`/`failedAt` and `expiresAt`; `scheduleRetry` keeps the payload and writes `attempts`, `nextAttemptAt`, `lastError` and `lockedUntil: null` - in-memory and Mongo (AC 17)
Proof: `pnpm exec vitest run src/shared/testing/in-memory-outbox.spec.ts src/shared/infrastructure/mongo/mongo-outbox.integration.spec.ts -t "marks an effect processed|marks an effect failed|schedules a retry"`

**C31** - `dateSchema` keeps a valid `Date` as the same instant, decodes `<ISO>Z` and `2026-11-02T10:00:00.123+03:00` into the `Date` of that instant, and refuses an epoch number, an Invalid Date, `null`, a word, a date without time, `2026-02-30T10:00:00Z` and `2026-12-31T23:59:60Z`, each with exactly one violation `{ field, reason: "~refine" }` (Landing door 8)
Proof: `pnpm exec vitest run src/shared/presentation/date.schema.spec.ts -t "keeps a valid Date and refuses anything else"`
Proof: `pnpm exec vitest run src/shared/presentation/date.schema.spec.ts -t "decodes an ISO date-time string into the Date of that instant"`

## Coverage

| Set (size)                                                   | Member -> proof                                                                                     | Unproven |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | -------- |
| `POST /auth/password-reset/request` statuses (3)             | `204` C6 · `400` C7 · `429` C7                                                                      | -        |
| `POST /me/email-verification` statuses (4)                   | `204` C6 · `401` C7 · `409` C7 · `429` C7                                                           | -        |
| use cases that record an e-mail effect (3)                   | reset C1 · sign-up C3 · verification request C4                                                     | -        |
| effect types, door 2 (2)                                     | `identity.password_reset_email` C8 · `identity.email_verification_email` C20                        | -        |
| relay outcomes (5)                                           | delivered C9 · retried C10 · abandoned after 8 C12 · no handler C13 · refused payload C30           | -        |
| backoff waits by attempt, door 4 (7)                         | C11, table-driven over attempts 1-7                                                                 | -        |
| reservation conditions, door 3 (6)                           | processed C14 · failed C14 · not yet due C14 · lock held C14 · lock passed C14 · earliest first C14 | -        |
| finished states without payload, door 5 (2)                  | processed C9 C28 · failed C12 C13 C28                                                               | -        |
| outbox implementations under the contract (2)                | in-memory C5 C14 C28 · Mongo C5 C14 C28                                                             | -        |
| `dateSchema` accepted forms, door 8 (2)                      | `Date` C31 · ISO date-time C31                                                                      | -        |
| identity consumers (2)                                       | password reset C20 C23 · verification C20 C24                                                       | -        |
| token expiry edges (3)                                       | `expiresAt` − 1 ms C25 · `expiresAt` C25 · after C25                                                | -        |
| relay lifecycle moments (4)                                  | idle wait C17 · no wait after one C17 · stop in flight C18 · stop idle C18                          | -        |
| `outbox` indexes, door 1 (2)                                 | reservation C27 · TTL `expiresAt_1` C27                                                             | -        |
| startup config: relay wired with the handlers (2 assemblies) | `start` C19 C20 · `createIdentityModule` handlers C21 C26                                           | -        |

- Claims naming a status code or route: C6, C7 - both proven over real HTTP (`createIdentityHttp`, supertest)
- No other check claims more than the single case its proof exercises

## Swept

- validation: C27, C29, C30 - the `type` format is enforced where the effect is persisted; the payload is parsed by the consumer's schema when it is delivered, and a refused one is abandoned
- failure modes: C10, C12, C13
- idempotency: n/a - delivery is at least once by plan (`Out of scope`); C16 keeps two relays from taking the same effect
- authorization: existing - the reset route stays public and rate-limited, `/me/email-verification` stays behind `AuthenticateMiddleware` and `RateLimitPolicy.EMAIL_VERIFICATION_REQUEST_PER_IP`
- concurrency: C14, C16
- data lifecycle: C26, C27, C28
- dependency failure: C6, C21, C22
- state transitions: C9, C10, C12, C13
- observability: C10, C12, C13, C22, C25

## Handoff

- S1-S4 = 184 KB across the 25 existing files touched plus ~60 KB new (`wc -c`, /4) ≈ 61k, under the 150k budget - one builder
- **Boundary:** C1-C28 closed (uncommitted, awaiting the user's review); `pnpm test:unit:coverage`, `pnpm test:integration:coverage`, `pnpm test:e2e:coverage` (strict route statuses) and `pnpm test:coverage` all exit 0 at 100%
- **Settled mid-build:** the user asked for `FakeClock` to start at `faker.date.recent()` instead of the fixed `2026-01-01T12:00Z` (no test depended on the fixed date), and for a sweep of fixed strings in specs that should come from faker - run in parallel over the specs this feature does not touch. `FakeClock` moved to `src/shared/testing` because the relay spec lives in `src/shared`, which cannot import a module. The verification e-mail is recorded by `EmailVerificationIssuer` (shared by sign-up and `POST /me/email-verification`) instead of by each use case; `Flow` says so. `createIdentityModule` receives the outbox in `IdentityRuntime`, so `start` builds one `MongoOutbox` for both the module and the relay. After review, the user asked for a single clock too: `IdentityRuntime` carries the `Clock` that `start` creates for the outbox and the relay, and `STACK.md` now states one instance per process of each shared adapter. A missing handler stores `lastError: "shared.outbox_handler_missing"`. `relayNext()` is public so the module spec can relay one effect at a time. The `422` tests of both routes became the C6 `204` tests; the specs that read tokens from `FakeIdentityMailer` read them from the outbox through `recordedEmails`
- **Settled after review (2):** the user asked for the outbox payload to go through a presentation handler with a TypeBox schema and a use case, like an HTTP route, instead of `TokenEmailOutboxHandler` casting `payload as TokenEmail` - Landing door 7, C23-C25 moved to the `SendPasswordResetEmail`/`SendEmailVerificationEmail` use case specs, C29-C30 added, C20 now covers both consumers. One `Dispatcher` per process: `start` creates it and passes it to `createServer` (new `dispatcher` option) and to `OutboxConsumerAdapter`. `src/shared/presentation/boundary.spec.ts` lists the three new presentation files
- **Settled after verification:** the user asked for `dateSchema` to be the basic date type; a `Date` only would refuse every date sent over JSON (HTTP body, BullMQ), so it also takes an ISO date-time string (Landing door 8, C31), and the adapter spec's refused payload uses a word instead of an ISO string
- **Abandoned:** a `FakeClock` frozen before the request in the module spec - effects recorded by the system clock were never due; the outbox and the relay now share one `FakeClock`
