# Transactions checks

Profile: light
Plan: `.specs/features/transactions/plan.md`

20 checks in 3 slices · 5 one-way doors · 0 open, of which 0 block

## Checks

Grouped by the plan's slices; numbering runs across the whole feature. `MTR` is
`src/shared/infrastructure/mongo/mongo-transaction-runner.integration.spec.ts`, `ITR` is
`src/shared/testing/in-memory-transaction-runner.spec.ts`, `REPOS` is
`src/modules/identity/infrastructure/persistence src/modules/identity/application/testing/in-memory-identity-repositories.spec.ts`
(the six repository contracts on both implementations), `UC` is
`src/modules/identity/application/use-cases`, `START` is `src/app/start.e2e.spec.ts`, `MDB` is
`src/shared/infrastructure/mongo/mongo-database.integration.spec.ts`.

### S1 - The runner writes everything or nothing · ~30 files · 60 KB · ~15k

**C1** - On a single-node replica set, a `run` whose work inserts two documents through two models and resolves `42` keeps both documents stored and resolves `42` (AC 1)
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-transaction-runner.integration.spec.ts -t "keeps every write of a work that resolves"`

**C2** - A `run` whose work inserts a document, updates another one and then throws an error rejects with that same error instance, and afterwards the inserted document is absent and the updated one holds its old value - with no `session` passed to any model call (AC 2, door 3)
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-transaction-runner.integration.spec.ts -t "undoes every write of a work that throws"`

**C3** - An `afterCommit` callback registered inside a `run` has not run when the work returns, runs exactly once by the time `run` resolves, and never runs when the work throws (AC 3, AC 4, door 2)
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-transaction-runner.integration.spec.ts -t "runs the after-commit callbacks once, after the commit"`
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-transaction-runner.integration.spec.ts -t "drops the after-commit callbacks of a work that throws"`

**C4** - When the first attempt of the work inserts a document, registers an `afterCommit` callback and throws a `MongoServerError` labelled `TransientTransactionError`, the work runs 2 times, the collection holds exactly 1 copy of the document, and the callback runs exactly 1 time (AC 5, door 2)
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-transaction-runner.integration.spec.ts -t "keeps only the last attempt when the driver retries"`

**C5** - A `run` called inside another `run` rejects with `shared.nested_transaction`, and the document the outer work had inserted before it is absent afterwards (AC 6, door 5)
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-transaction-runner.integration.spec.ts -t "refuses a run inside a run"`

**C6** - Outside a `run`, an `afterCommit` callback runs before `afterCommit` returns (AC 7, door 2)
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-transaction-runner.integration.spec.ts -t "runs an after-commit callback at once outside a run"`

**C7** - The `InMemoryTransactionRunner` resolves with the work's value and runs the `afterCommit` callbacks once after the work; when the work throws it rejects with that error, runs the `onRollback` callbacks in reverse order of registration and none of the `afterCommit` ones; outside a `run`, `afterCommit` runs at once and `onRollback` never runs; `run` inside `run` rejects with `shared.nested_transaction` and the outer rollbacks run (AC 8)
Proof: `pnpm exec vitest run src/shared/testing/in-memory-transaction-runner.spec.ts -t "resolves with the value and runs the after-commit callbacks once"`
Proof: `pnpm exec vitest run src/shared/testing/in-memory-transaction-runner.spec.ts -t "runs the rollbacks in reverse order when the work throws"`
Proof: `pnpm exec vitest run src/shared/testing/in-memory-transaction-runner.spec.ts -t "runs an after-commit callback at once and skips a rollback outside a run"`
Proof: `pnpm exec vitest run src/shared/testing/in-memory-transaction-runner.spec.ts -t "refuses a run inside a run"`

**C8** - For each of the six repository contracts, on Mongo and in memory: a new entity saved inside a `run` still has version `0` while the work runs, and has version `1`, equal to the stored snapshot, once `run` resolves (AC 4, AC 8)
Proof: `pnpm exec vitest run src/modules/identity/infrastructure/persistence src/modules/identity/application/testing/in-memory-identity-repositories.spec.ts -t "moves the version only when the transaction commits"`

**C9** - For each of the six repository contracts, on Mongo and in memory: a new entity saved inside a `run` whose work then throws is not found by id afterwards and keeps version `0` (AC 2, AC 3, AC 8)
Proof: `pnpm exec vitest run src/modules/identity/infrastructure/persistence src/modules/identity/application/testing/in-memory-identity-repositories.spec.ts -t "stores nothing from a transaction that fails"`

**C10** - On Mongo and in memory, an account stored at version `1`, renamed and saved inside a `run` whose work then throws, is loaded back with its old name and version `1`, and the instance keeps version `1` (AC 2, AC 3, AC 8)
Proof: `pnpm exec vitest run src/modules/identity/infrastructure/persistence/mongo-account.repository.integration.spec.ts src/modules/identity/application/testing/in-memory-identity-repositories.spec.ts -t "keeps the stored account when the transaction fails"`

### S2 - The use cases write everything or nothing · 33 files · 87 KB · ~22k

**C11** - In each of the 11 use cases, when the last write of the call rejects with an error, the use case rejects with that same error and none of the entities it saved earlier in the call is stored afterwards (each spec names the entities it checks) (AC 9)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases -t "writes nothing when the last write fails"`

**C12** - `RequestPasswordReset` and `RequestEmailVerification` call the mailer outside the transaction (`InMemoryTransactionRunner` reports no `run` in progress during the call), with the token already stored, and send no e-mail when the token write rejects (AC 10)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/request-password-reset.use-case.spec.ts src/modules/identity/application/use-cases/request-email-verification.use-case.spec.ts -t "sends the e-mail after the transaction commits"`
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/request-password-reset.use-case.spec.ts src/modules/identity/application/use-cases/request-email-verification.use-case.spec.ts -t "writes nothing when the last write fails"`

**C13** - `SignInWithOAuth` calls `oauth.exchangeCode` exactly 1 time per call, with no `run` in progress, on the sign-up branch and on the sign-in branch (AC 11)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/sign-in-with-oauth.use-case.spec.ts -t "exchanges the code once, outside the transaction"`

**C14** - Through `start` on a single-node replica set, 8 simultaneous `POST /api/auth/sign-up` with the same e-mail answer one `201` and seven `400` whose `code` is `identity.credential_email_taken` or `identity.account_email_taken`, and the database holds exactly 1 account, 1 credential and 1 membership with that e-mail (AC 12)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "answers one 201 to simultaneous sign-ups with the same e-mail"`

**C15** - The adapters `createIdentityAdapters` builds run their Mongo repositories inside their own `transactions`: an account saved inside `transactions.run` whose work throws is not found by id afterwards (AC 9, door 1)
Proof: `pnpm exec vitest run src/modules/identity/identity.module.integration.spec.ts -t "rolls back every write of a use case that fails halfway"`

### S3 - Mongo accepts transactions in every environment · 8 files · 45 KB · ~11k

**C16** - `MongoDatabase.connect` against a standalone server logs `shared.database_not_replica_set` at `error` with the `host`, rejects with `shared.database_not_replica_set`, and leaves the connection at `readyState` `0` (AC 13, door 4)
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-database.integration.spec.ts -t "refuses a server that is not a replica set member"`

**C17** - `start` with a `MONGO_URL` pointing at a standalone server rejects with `shared.database_not_replica_set` and never logs `shared.server_started` (AC 13)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "does not listen when the database is not a replica set"`

**C18** - `useMemoryMongo()` hands out a connection to a replica set member: `hello` on it answers a `setName` (door 4)
Proof: `pnpm exec vitest run src/shared/testing/memory-mongo.integration.spec.ts -t "connects to a replica set member"`

**C19** - `docker compose config` resolves the `mongo` service with a command carrying `--replSet rs0`, and a healthcheck that runs `rs.initiate` with the member `localhost:27017` and only exits 0 once the node is the writable primary; `.env.example` sets `MONGO_URL="mongodb://localhost:27017/identity-starter?replicaSet=rs0"` (AC 14, door 4)
Proof: `docker compose config --format json | python3 -c "import json,sys; s=json.load(sys.stdin)['services']['mongo']; c=' '.join(s['command']); t=' '.join(s['healthcheck']['test']); assert '--replSet rs0' in c; assert 'rs.initiate' in t and 'localhost:27017' in t and 'isWritablePrimary' in t"`
Proof: `grep -qx 'MONGO_URL="mongodb://localhost:27017/identity-starter?replicaSet=rs0"' .env.example`

**C20** - `pnpm lint`, `pnpm typecheck` and `pnpm test:coverage` exit 0, with coverage at 100% (project gate)
Proof: `pnpm lint && pnpm typecheck && pnpm test:coverage`

## Coverage

| Set (size)                                        | Member -> proof                                                                                                                                                                                                                                                                 | Unproven |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| use cases with more than one write (11)           | `SignUpWithEmail` C11 · `SignInWithEmail` C11 · `SignInWithOAuth` C11 · `RefreshSession` C11 · `ResetPassword` C11 · `ChangePassword` C11 · `DeactivateAccount` C11 · `VerifyEmail` C11 · `RequestPasswordReset` C11 · `RequestEmailVerification` C11 · `RevokeAllSessions` C11 | -        |
| repositories that defer the version (6)           | accounts C8 C9 · credentials C8 C9 · memberships C8 C9 · sessions C8 C9 · password resets C8 C9 · email verifications C8 C9                                                                                                                                                     | -        |
| runner implementations (2)                        | `MongoTransactionRunner` C1-C6 · `InMemoryTransactionRunner` C7                                                                                                                                                                                                                 | -        |
| `run` outcomes (4)                                | resolves C1 · throws C2 · transient retry C4 · nested C5                                                                                                                                                                                                                        | -        |
| `afterCommit` moments (3)                         | inside, committed C3 · inside, aborted C3 · outside C6                                                                                                                                                                                                                          | -        |
| doors (5)                                         | 1 port C1 C15 · 2 version on commit C3 C4 C8 · 3 session through ALS C2 · 4 replica set only C16 C18 C19 · 5 nested refused C5                                                                                                                                                  | -        |
| external calls kept outside `run` (3)             | password-reset e-mail C12 · verification e-mail C12 · OAuth `code` exchange C13                                                                                                                                                                                                 | -        |
| startup config: transaction runner (2 assemblies) | `createIdentityAdapters` (start) C15 · `createIdentityContext` (use-case specs) C11                                                                                                                                                                                             | -        |
| replica set environments (3)                      | tests `useMemoryMongo` C18 · `start.spec` C14 · docker compose C19                                                                                                                                                                                                              | -        |

- Claims naming a status code or error code: C5, C14, C16, C17 - C14 crosses the HTTP boundary; the others assert the `AppError` code where it is thrown
- C19 proves the compose configuration, not a live replica set: the Docker daemon is not running on this machine, so `docker compose up -d --wait` is left for the user to run
- No other check claims more than the single case its proof exercises

## Swept

- validation: n/a - no new input reaches the system
- failure modes: C2, C9, C10, C11
- idempotency: C4, C13
- authorization: n/a - no route, guard or policy changes
- concurrency: C4, C14
- data lifecycle: n/a - no stored-data shape change; the standalone volume keeps its data as a replica set (plan Impact)
- dependency failure: C16, C17
- state transitions: n/a - no entity gains or loses a state; only when the version moves changes (C8)
- observability: C16

## Handoff

- S1 = ~15k, S2 enters the use cases at ~37k, S3 at ~48k total, under the 150k budget - one builder
- Mechanism: one builder
- **Boundary:** C1-C20 closed (uncommitted, awaiting the user's review); C19 proven on the compose configuration only, because the Docker daemon is not running here
- **Settled mid-build:** in `SignInWithEmail`, `ChangePassword` and `ResetPassword`, the reads that the password hash or verify depends on stay outside `run` with the hash; only the writes go inside. Another session (NEXT-STEPS section 7) wired `MongoTransactionRunner` into `createIdentityAdapters` and moved `start.e2e.spec.ts` to `MongoMemoryReplSet`; this feature added its tests on top
- **Abandoned:** none. Note for the Verifier: C14 holds even with `afterCommit` running at once, because the sign-up retry re-reads and re-creates its entities inside `run`; the deferral itself is proven by C4
- **Later change:** the C15 proof now names "rolls back every write of a use case that fails halfway". NEXT-STEPS section 7 replaced `createIdentityAdapters` with `createIdentityModule(settings, runtime)`, and that test drives a sign-up through the real module and Mongo. The spec files were also renamed by test level (`*.integration.spec.ts`, `*.e2e.spec.ts`).
