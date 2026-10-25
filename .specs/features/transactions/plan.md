# Transactions

## Problem

The use cases that write more than one entity call one `save` after another, with nothing tying them together. When a write in the middle fails (Mongo goes down, `shared.version_conflict`, a duplicate e-mail in a concurrent sign-up), the earlier writes stay stored:

- a sign-up leaves a credential with no account, and the e-mail stays "taken" forever (`identity.credential_email_taken` on the next attempt);
- a refresh leaves the old session revoked without the new one, and the user is signed out;
- a password reset changes the password without consuming the token, and the same link works again.

The user pays for it, stuck in a state no route fixes. Today the problem is accepted on purpose (NEXT-STEPS, section 0, "Consistência na escrita"). There is no recorded incident, because there are no users yet.

When this ships, a use case writes everything or nothing, and two simultaneous sign-ups with the same e-mail still answer `400`, not `500` nor `409`.

## Flow

Reuses `MongoDatabase.connection`, the `OptimisticWriter`, the six Mongo repositories and the repository contracts. The driver's `withTransaction` (through `connection.transaction`) does the commit, the abort and the retry. None of that is reimplemented.

1. The HTTP route (exists) calls the use case (exists, `src/modules/identity/application/use-cases`).
2. The use case makes the external calls outside the transaction (the OAuth `code` exchange, the password hash) and calls `transactions.run(work)` (new port, door 1, `src/shared/application/ports`).
3. `MongoTransactionRunner` (new, door 1, `src/shared/infrastructure/mongo`) opens the session with `connection.transaction`. Mongoose passes the session to every operation inside `work` (door 3). A transient error makes the driver run `work` again.
4. The Mongo repositories (exist, `src/modules/identity/infrastructure/persistence`) write through the `OptimisticWriter` (exists), inside the session. `markAsSaved()` goes to the runner's queue instead of running at once (door 2).
5. On commit, the runner runs the queue: each entity moves its version once. On abort, it drops the queue and rethrows the error.
6. Out: the use case sends the e-mail (when there is one) after `run` resolves, and answers as today.

In tests, `InMemoryTransactionRunner` (new, no door, `src/shared/testing`) plays the same role: it undoes the in-memory snapshots when `work` fails.

## Impact

| Front             | What changes                                                                                                                                                                                                                                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| domain            | new term: `TransactionRunner`, shared port that runs a piece of work all or nothing; lives in `src/shared/application/ports`                                                                                                                                                                                                                                            |
| domain            | new errors: `shared.nested_transaction` (`run` inside `run`) and `shared.database_not_replica_set` (the Mongo server does not accept transactions)                                                                                                                                                                                                                      |
| internal contract | `markAsSaved()` runs right after the write today. Inside a `run`, it runs only on commit. Consequence: the same instance saved twice in the same `run` gets `shared.version_conflict`. No use case does that today: the two `save(account)` in `SignInWithOAuth` and the two `save(verification)` in `RequestEmailVerification` are on different branches or instances. |
| internal contract | the six Mongo repositories, the six in-memory ones, `createMongoIdentityRepositories(connection)` and `createIdentityContext()` receive the runner; the repository contracts receive the repository and the runner                                                                                                                                                      |
| internal contract | 11 use cases get `transactions` in their `deps`: `SignUpWithEmail`, `SignInWithEmail`, `SignInWithOAuth`, `RefreshSession`, `ResetPassword`, `ChangePassword`, `DeactivateAccount`, `VerifyEmail`, `RequestPasswordReset`, `RequestEmailVerification`, `RevokeAllSessions`                                                                                              |
| local environment | the `docker-compose.yml` Mongo starts as the single-node replica set `rs0`. Each developer's `.env` `MONGO_URL` needs `?replicaSet=rs0` (`.env.example` changes; the local `.env` does not)                                                                                                                                                                             |
| tests             | `useMemoryMongo()`, `start.e2e.spec.ts` and `mongo-database.integration.spec.ts` move from `MongoMemoryServer` to a single-node `MongoMemoryReplSet`. Startup gets ~1 to 2 s slower per file                                                                                                                                                                            |
| working tree      | step 6 (mailer and OAuth) is still uncommitted and touches `identity.module.ts` and `start.ts`, which this feature also changes. The two diffs mix unless step 6 is committed first                                                                                                                                                                                     |
| stored data       | nothing to migrate: the standalone `.data/mongo` volume starts as a replica set without losing data (`rs.initiate` only creates the oplog)                                                                                                                                                                                                                              |

## Relations

None - no stored-data shape change.

## Surface

None - no new route and no changed signature; every route keeps today's statuses.

## Landing

| One-way door                         | Literal shape                                                                                                                                                                                                      | Alternative rejected                                                                                                                                                                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Transaction port (precedent)      | `interface TransactionRunner { run<T>(work: () => Promise<T>): Promise<T> }`, called by the use case: `await this.deps.transactions.run(async () => { ...saves })`; external calls and e-mail stay outside         | Full Unit of Work (repositories register instead of writing, and the commit writes in a batch): needs change tracking per entity, a mini-ORM on top of Mongoose. Transaction opened by an HTTP middleware: wraps the e-mail and the OAuth `code` exchange, which the retry would repeat (the `code` is single use) |
| 2. Version confirmed on commit       | inside `run`, repositories call `transactions.afterCommit(() => entity.markAsSaved())`; outside `run`, `afterCommit` runs at once; the queue is reset on every driver attempt                                      | `startTransaction`/`commitTransaction` by hand, with no retry: two simultaneous sign-ups with the same e-mail get `WriteConflict` (`500`) instead of `400`. Retry with `markAsSaved` at once: the second attempt writes the new entity as version 1 and gets `shared.version_conflict` (`409`)                     |
| 3. Session through AsyncLocalStorage | `mongoose.set("transactionAsyncLocalStorage", true)` in `MongoTransactionRunner`; repositories do not receive a `session`                                                                                          | passing `session` to every method: changes the six repository ports and every use-case call                                                                                                                                                                                                                        |
| 4. Mongo only as a replica set       | `MongoDatabase.connect` checks `hello.setName` and refuses with `shared.database_not_replica_set`; compose with `--replSet rs0` and `rs.initiate` in the healthcheck; tests with `MongoMemoryReplSet` (`count: 1`) | falling back to "no transaction" on a standalone: back to partial writes, silently, exactly in the environment that gave no warning                                                                                                                                                                                |
| 5. Nested `run`                      | `run` inside `run` throws `shared.nested_transaction` before opening another session                                                                                                                               | joining the outer transaction: hides a service that opens its own transaction, and the rule "the use case opens it" stops holding                                                                                                                                                                                  |

- Nothing else in this change is hard to reverse.

## Criteria

### S1: the runner writes everything or nothing (P1)

`TransactionRunner.run` on Mongo and in memory, with the version confirmed only on commit.

**Acceptance Criteria**

1. WHEN the `work` given to `run` resolves THEN the system SHALL keep every write made inside it stored and resolve `run` with the value `work` returned.
2. IF the `work` throws an error THEN the system SHALL undo every write made inside it and reject `run` with the same error.
3. IF the `work` throws an error after saving an entity THEN the in-memory version of that entity SHALL NOT change.
4. WHEN the `work` resolves THEN each entity saved inside it SHALL hold the version stored in the database (`version + 1`) as soon as `run` resolves.
5. WHEN the driver runs the `work` again because of an error labelled `TransientTransactionError` THEN each saved entity SHALL move its version exactly 1, and the database SHALL store a single copy of it.
6. IF `run` is called inside another `run` THEN the system SHALL reject with `shared.nested_transaction` and the outer `run` SHALL undo what it had already written.
7. The `save` of each of the six repositories SHALL, outside a `run`, write at once and move the version at once, as today.
8. The `InMemoryTransactionRunner` SHALL meet criteria 1, 2, 3, 4, 6 and 7 with the six in-memory repositories, proven by the same contract that runs on Mongo.

**Independent test:** the runner contract with the accounts repository: a `run` that writes and resolves, and a `run` that writes and throws, against Mongo (in-memory replica set) and against memory.

### S2: the use cases write everything or nothing (P1)

The 11 use cases with more than one write now write inside `run`.

**Acceptance Criteria**

9. IF the last write of any of the 11 use cases listed in Impact fails THEN none of that use case's earlier writes SHALL stay stored, and the use case SHALL reject with the write's error.
10. WHEN `RequestPasswordReset` or `RequestEmailVerification` store the token THEN the e-mail SHALL be sent only after `run` resolves. IF a write fails THEN no e-mail SHALL be sent.
11. The `SignInWithOAuth` SHALL exchange the `code` with the provider exactly once per call, outside the `run`.
12. WHEN 8 sign-ups with the same e-mail arrive at the same time THEN the system SHALL answer one `201` and seven `400` (`identity.credential_email_taken` or `identity.account_email_taken`), and store exactly 1 account, 1 credential and 1 membership with that e-mail.

**Independent test:** in the `SignUpWithEmail` spec, the membership write fails; afterwards, `accounts.findByEmail` and `credentials.findByEmail` return `null`.

### S3: Mongo accepts transactions in every environment (P2)

**Acceptance Criteria**

13. IF the Mongo server is not a replica set member THEN `MongoDatabase.connect` SHALL log `shared.database_not_replica_set` with the `host`, close the connection and reject with `shared.database_not_replica_set`, and `start` SHALL NOT listen on the port.
14. WHEN `docker compose up -d --wait` finishes THEN Mongo SHALL answer `rs.status().set` equal to `rs0`, with its own node as `PRIMARY`.

**Independent test:** `start` pointed at a standalone `MongoMemoryServer` rejects without listening.

## Out of scope

| Excluded                                                        | Why                                                                       |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Event outbox                                                    | arrives with the first event between modules; it will use this same `run` |
| Full Unit of Work (write only what changed, in a batch)         | no use case changes enough entities to pay for change tracking            |
| Transactions in use cases with a single write                   | a single write is already atomic in Mongo                                 |
| Tuning `readConcern`, `writeConcern` and the retry's time limit | the driver defaults stay (`withTransaction` retries for up to 120 s)      |

## Assumptions

| Assumption                | Chosen default                                                                                          | Rationale                                                                                            | Confirmed? |
| ------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------- |
| Which use cases use `run` | the 11 with more than one write, not only the sign-ups                                                  | refresh, password reset and the others have the same partial-write bug, and each costs one more line | y          |
| What goes inside `run`    | reads and writes; password hash, OAuth `code` exchange and e-mail stay outside                          | the retry re-reads the current state; external calls cannot be repeated, and the hash is slow        | y          |
| Nested `run`              | refused with `shared.nested_transaction`                                                                | same choice as linkio; a loud error in tests instead of a hidden transaction                         | y          |
| Local `MONGO_URL`         | `mongodb://localhost:27017/resolve-hub?replicaSet=rs0`, with the member registered as `localhost:27017` | the app runs on the host (`pnpm dev`), not inside compose                                            | y          |
| In-memory runner          | undoes the snapshots when `work` fails (does not only run `work`)                                       | each use case's spec proves "all or nothing" without starting Mongo                                  | y          |

**Open questions:** none - all resolved or logged above.

## Observable

None - no user-facing surface changes; the routes keep their signature, statuses and error shape.

## Sources

- `NEXT-STEPS.md`, section 0, "Consistência na escrita" - the problem accepted until now.
- `/home/felipeboff/workspace/linkio/backend/src/shared/infrastructure/adapters/mongo-transaction-runner.adapter.ts` - the port's shape and the nested `run` refusal.
