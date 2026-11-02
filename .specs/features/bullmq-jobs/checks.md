# BullMQ jobs checks

Profile: light
Plan: `.specs/features/bullmq-jobs/plan.md`

20 checks in 2 slices · 6 one-way doors · 0 open, of which 0 block

## Checks

Grouped by the plan's slices; numbering runs across the whole feature.

### S1 - The BullMQ worker runs the outbox effects · 16 files · 120 KB · ~30k

**C1** - The relay hands a due effect to the `OutboxQueue` and writes `lockedUntil` = now + 2 h on it (AC 1)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "hands a due effect to the queue and holds it for 2 hours"`

**C2** - `BullOutboxQueue.enqueue` adds to the `outbox` queue a job named after the effect `type`, with `jobId` = effect id, data `{ payload }`, `attempts` 8, backoff `{ type: "exponential", delay: 30000, jitter: 1 }`, `removeOnComplete: true` and `removeOnFail: true` (AC 1, AC 3, AC 8, door 2)
Proof: `pnpm exec vitest run src/shared/infrastructure/jobs/bull-outbox-queue.integration.spec.ts -t "adds a job named after the effect type with its id and retry policy"`

**C3** - The queue keeps a single job when the same effect id is enqueued twice (AC 6)
Proof: `pnpm exec vitest run src/shared/infrastructure/jobs/bull-outbox-queue.integration.spec.ts -t "keeps a single job for the same effect id"`

**C4** - When the handler of the type finishes, the runner writes `processedAt`, erases the `payload` and writes `expiresAt` = `processedAt` + 7 days (AC 2)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-effect-runner.spec.ts -t "marks the effect processed when its handler finishes"`

**C5** - When the handler fails before the 8th attempt, the runner logs `warn` `shared.outbox_effect_failed` with `id`, `type` and `attempts` and leaves the effect pending for another attempt (AC 3)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-effect-runner.spec.ts -t "logs the failure and asks for another attempt before the last one"`

**C6** - When the 8th attempt fails, the runner writes `failedAt`, `attempts` = 8 and `lastError`, erases the `payload`, writes `expiresAt` = `failedAt` + 7 days and logs `error` `shared.outbox_effect_abandoned` with `id`, `type` and `attempts` (AC 4)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-effect-runner.spec.ts -t "abandons the effect when the last attempt fails"`

**C7** - A payload refused with `shared.input_invalid` and a type with no handler are each abandoned on the first attempt, written and logged as in C6 with `attempts` = 1 (AC 5)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-effect-runner.spec.ts -t "abandons at once"`

**C8** - The worker puts a failed job back for another attempt: after one failure the job is delayed with `attemptsMade` 1 (AC 3 at the queue)
Proof: `pnpm exec vitest run src/shared/infrastructure/jobs/bull-outbox-worker.integration.spec.ts -t "puts a failed job back for another attempt"`

**C9** - The worker fails an abandoned job without another attempt (AC 5 at the queue)
Proof: `pnpm exec vitest run src/shared/infrastructure/jobs/bull-outbox-worker.integration.spec.ts -t "fails an abandoned job without another attempt"`

**C10** - A job of the `outbox` queue is removed from Redis when it succeeds and when it is abandoned (AC 8)
Proof: `pnpm exec vitest run src/shared/infrastructure/jobs/bull-outbox-worker.integration.spec.ts -t "removes the job from Redis when it ends"`

**C11** - Once the 2 h of a handed-over effect pass with no `processedAt` and no `failedAt`, the relay hands it to the queue again (AC 6)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "hands an effect over again once its 2 hours pass"`

**C12** - When the queue refuses the effect, the relay logs `error` `shared.outbox_relay_failed`, leaves it pending and hands it over again once the 30 s reservation passes (AC 7)
Proof: `pnpm exec vitest run src/shared/application/services/outbox-relay.spec.ts -t "leaves the effect pending when the queue refuses it"`

**C13** - `stop` stops the relay, closes the BullMQ workers and queues, and only then closes Redis and Mongo (AC 9, door 5)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "closes the relay and the jobs before Redis and Mongo"`

**C14** - The running app delivers the e-mails recorded in the outbox through BullMQ: both effects end with `processedAt` and the `outbox` queue holds no job (S1 independent test)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "delivers the e-mails recorded in the outbox while it runs"`

**C20** - With Redis gone, the outbox queue (on the `RedisConnection` client) fails an enqueue at once and still closes, and a worker still closes; with Redis up, a worker closes only after the job it is running finishes (door 6, AC 9)
Proof: `pnpm exec vitest run src/shared/infrastructure/jobs/bull-outbox-queue.integration.spec.ts -t "fails an enqueue at once, and still closes, once Redis goes away"`
Proof: `pnpm exec vitest run src/shared/infrastructure/jobs/bull-outbox-worker.integration.spec.ts -t "closes even when Redis is away"`
Proof: `pnpm exec vitest run src/shared/infrastructure/jobs/bull-outbox-worker.integration.spec.ts -t "waits for the job it is running before it closes"`

### S2 - A module declares a scheduled job · 6 files · 30 KB · ~8k

**C15** - Syncing creates one scheduler per declared `ScheduledJob` in the `scheduled` queue, with id = `name`, the declared `pattern` and `tz`, and a template of `attempts` 3 and backoff `{ type: "exponential", delay: 60000 }` (AC 10, AC 13, door 3)
Proof: `pnpm exec vitest run src/shared/infrastructure/jobs/bull-scheduled-jobs.integration.spec.ts -t "upserts one scheduler per declared job"`

**C16** - Syncing removes a scheduler of the `scheduled` queue that no module declares (AC 11)
Proof: `pnpm exec vitest run src/shared/infrastructure/jobs/bull-scheduled-jobs.integration.spec.ts -t "removes a scheduler no module declares"`

**C17** - With two workers on the same Redis, a job that fires every second reaches its handler once per occurrence (AC 12)
Proof: `pnpm exec vitest run src/shared/infrastructure/jobs/bull-scheduled-jobs.integration.spec.ts -t "runs each occurrence once with two workers"`

**C18** - A failing scheduled job logs `warn` `shared.scheduled_job_failed` with `name`, `attempts` = 1 and the error (AC 13)
Proof: `pnpm exec vitest run src/shared/infrastructure/jobs/bull-scheduled-jobs.integration.spec.ts -t "logs each failure of a scheduled job"`

**C19** - `start` syncs the modules' scheduled jobs: a scheduler no module declares is gone from the `scheduled` queue once it starts (startup config, AC 10, AC 11)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "syncs the modules' scheduled jobs on start"`

## Coverage

| Set (size)                                          | Member -> proof                                                                                                                            | Unproven |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| runner outcomes for one attempt (5)                 | handler finishes C4 · fails before the 8th C5 · fails on the 8th C6 · refused payload C7 · no handler C7                                   | -        |
| outbox job options (6)                              | name = `type` C2 · `jobId` = id C2 · `attempts` 8 C2 · exponential backoff 30 s with jitter C2 · `removeOnComplete` C2 · `removeOnFail` C2 | -        |
| relay paths for a due effect (3)                    | handed over C1 · handed over again after 2 h C11 · queue refuses C12                                                                       | -        |
| ways an outbox job ends in Redis (3)                | retried C8 · failed without retry C9 · removed when it ends C10                                                                            | -        |
| scheduler sync (2)                                  | declared upserted C15 · undeclared removed C16                                                                                             | -        |
| startup config: queues, workers and relay (1 place) | `start` C13, C14, C19                                                                                                                      | -        |
| Landing doors (6)                                   | 1 C2, C15 · 2 C1, C2, C9, C11 · 3 C15, C16 · 4 C1, C12 · 5 C13 · 6 C20                                                                     | -        |

- Claims naming a log event, a field value or a job option: C2, C5, C6, C7, C12, C15, C18 - each has a proof that asserts that value
- No other check claims more than the single case its proof exercises

## Swept

- validation: C7 (a refused payload is abandoned)
- failure modes: C5, C6, C12, C18, C20
- idempotency: C3 (one job per effect id)
- authorization: n/a - no route; the queues are reached only by the API process through Redis
- concurrency: C17 (one run per occurrence with two workers), C3 (two hand-overs of one effect keep one job)
- data lifecycle: C10 (jobs leave Redis when they end), C4 and C6 (finished effects lose the payload and expire in 7 days)
- dependency failure: C12 (Redis refuses the job), C8 (the handler's provider fails)
- state transitions: C4, C6, C11 (pending -> handed over -> processed, failed, or handed over again)
- observability: C5, C6, C18

## Handoff

- S1: existing files touched (relay, store port, Mongo and in-memory outbox with their specs and contract, consumer adapter, `start` and its e2e spec, shared log events) = 60 736 bytes / 4 ≈ 15k, plus about 10k of new files (queue port, runner, BullMQ queue and worker with specs) ≈ 25k
- S2: about 8k of new files (scheduled job type, BullMQ scheduler with spec) plus the `start` hunks already counted in S1
- S3 (removed after round 1 of verification): existing files touched (account entity, issuer, mailer port and both mailers, composer and its spec, account repositories, schema, contract, identity module, context, outbox consumers) = 67 404 bytes / 4 ≈ 17k, plus about 15k of new files (two use cases, two handlers, schedule, specs) ≈ 32k
- 65k in total, under the 150k budget - one builder
- **Boundary:** C1-C33 closed in round 1; after the reminder was removed, C1-C20 closed (uncommitted, awaiting the user's review); `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test:coverage`, `pnpm test:unit:coverage`, `pnpm test:integration:coverage` and `pnpm test:e2e:coverage` (strict route statuses) all exit 0, every coverage run at 100%
- **Settled mid-build:** the user approved the plan as written and delegated the assumptions ("implementa conforme o plano, depois eu vejo"). Probes against a Redis that went away showed that a queue on BullMQ's own connection waits forever on an enqueue and on `close()`, so the queues moved to the `RedisConnection` client and the workers close by pausing, waiting for their running jobs and calling `close(true)` (Landing door 8 then, door 6 now; C33 then, C20 now). The project's ESLint rule only allows throwing `AppError`; it now also allows BullMQ's `UnrecoverableError`, the only way BullMQ skips a job's retries (door 2 kept as approved). `pnpm-workspace.yaml` denies the build scripts of `@scarf/scarf` and `msgpackr-extract`. The relay's retry and backoff tests moved to `OutboxEffectRunner` (the run and its outcomes) and to the BullMQ queue spec (the options); the store contract replaced `scheduleRetry` with `markHandedOver`. The module spec delivers through the runner instead of the relay, and its MailerSend retry test now expects the effect pending after the first failure (attempts and the last error live in BullMQ during retries). `createIdentityHttp` also returns the assembled module, for the schedule e2e. ADR-012 records the decision and ADR-010's status points to it
- **Abandoned:** BullMQ's own connection for the queues and a graceful `close()` with a deadline and then `close(true)` (BullMQ 6.3.17 hands the pending close to the second call, so the force never happened); an `unreachableRedisUrl` test helper, unused once the specs stopped a `RedisMemoryServer` instead
- **Settled after verification:** the user removed the e-mail verification reminder (S3, C20-C32, Landing doors 5-6, the `Account` field) and kept the scheduled-job setup with no job declared; C33 became C20, doors 7-8 became 5-6, and the `start` e2e proves the sync by removing a stale scheduler instead of finding the reminder's
