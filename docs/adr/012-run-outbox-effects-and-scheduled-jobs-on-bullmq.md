# ADR-012: Run Outbox Effects and Scheduled Jobs on BullMQ

- **Date**: 2026-11-02
- **Status**: Accepted
- **Deciders**: Felipe Boff
- **Tags**: integration, resilience, jobs, redis

## Context and Problem Statement

The `OutboxRelay` ran every effect itself, one at a time, with its own retry
([ADR-010](010-transactional-outbox-in-mongo-with-an-in-process-relay.md)). Nothing could run at a
time of day: a daily task would have been a timer in every API instance, firing once per instance.
Redis already runs next to the API.

## Decision Drivers

- An effect is still born in the transaction that needs it, so none is lost between the commit and
  the queue
- A scheduled task runs once per occurrence, however many API instances there are
- Retry, backoff and concurrency come from a maintained library, not from the relay
- `stop` never hangs on Redis, and closes the jobs before Redis and Mongo

## Considered Options

- Mongo outbox as the record, BullMQ runs the effects and the scheduled jobs
- BullMQ only, use cases enqueue after the commit (no Mongo outbox)
- Mongo outbox as is, plus `node-cron` in the process for scheduled tasks
- Agenda (a scheduler on MongoDB)

## Decision Outcome

Chosen option: **Mongo outbox as the record, BullMQ runs the effects and the scheduled jobs**,
because it keeps ADR-010's transactional guarantee and gets BullMQ's retry and its one-run-per-
occurrence schedulers.

- The relay reserves a due effect as before, adds it to the `outbox` queue
  (`jobId` = effect id, 8 attempts, exponential backoff from 30 s with full jitter, removed when it
  ends) and holds the effect for 2 h; a hand-off that outlives the 2 h is repeated, and the `jobId`
  keeps one job
- A worker (concurrency 5) runs the handler through `OutboxEffectRunner`, which writes
  `processedAt` or `failedAt` in Mongo; a refused payload or a missing handler fails the job with
  `UnrecoverableError`
- Modules declare `ScheduledJob`s (cron pattern and time zone) like routes; `start` upserts one
  BullMQ job scheduler per job and removes the ones nobody declares
- The queues use the `RedisConnection` client, which fails fast; the workers open their own
  blocking connections and close by force once the jobs they run have finished

### Positive Consequences

- A failing provider is retried with backoff by BullMQ, up to 5 effects in parallel
- Scheduled work runs once per occurrence and survives restarts
- The API answers the same way; no module declares a scheduled job yet

### Negative Consequences

- The effect lives in Mongo and in Redis at once; the plain-text token is in the job data (and in
  Redis snapshots) until the job ends
- The retry backoff has no 30 min cap any more; the last wait reaches 32 min
- Redis must use `maxmemory-policy noeviction`, and e-mails stop (without being lost) while it is
  down
- A job picked at the very moment of `stop` is force-closed and runs again later

## Pros and Cons of the Options

### Mongo outbox as the record, BullMQ runs ✅ Chosen

- ✅ No effect lost between commit and queue; retries and schedules from BullMQ
- ❌ Two stores to keep coherent (the 2 h hold and the `jobId`)

### BullMQ only, enqueued after the commit

- ✅ One store, no polling
- ❌ A crash or a Redis outage between the commit and the enqueue loses the e-mail

### Outbox as is plus `node-cron`

- ✅ No new dependency
- ❌ Every instance fires each task; a missed run is lost

### Agenda

- ✅ Schedules stored in the database already used
- ❌ One more dependency polling Mongo for what Redis already does

## Links

- Supersedes the running and retry parts of [ADR-010](010-transactional-outbox-in-mongo-with-an-in-process-relay.md); the Mongo outbox stays
- `.specs/features/bullmq-jobs/plan.md` - the literal shapes (Landing doors 1-6)
