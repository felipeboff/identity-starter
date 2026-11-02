# Mongo Connection checks

Profile: light
Plan: `.specs/features/mongo-connection/plan.md`

21 checks in 5 slices · 5 one-way doors · 0 open, of which 0 block

## Checks

Grouped by the plan's slices; numbering runs across the whole feature. `MDB` is
`src/shared/infrastructure/mongo/mongo-database.integration.spec.ts`, `START` is `src/app/start.e2e.spec.ts`,
`SERVER` is `src/app/create-server.e2e.spec.ts`, `SHUT` is `src/app/shutdown.spec.ts`.

### S1 - Start only with the database connected · 6 files · 24 KB · ~6k

**C1** - `MongoDatabase.connect()` resolves only once the connection is open: `connection.readyState` is `1` right after it resolves (AC 1)
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-database.integration.spec.ts -t "opens the connection"`

**C2** - `start` logs `shared.database_connected` before `shared.server_started`, and the first `GET /health` after `start` resolves answers `200` (AC 1)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "connects to the database before listening"`

**C3** - On connect, `MongoDatabase` logs `shared.database_connected` at `info` with the server `host` and the `database` name (AC 2)
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-database.integration.spec.ts -t "logs the host and database it connected to"`

**C4** - Against a port nothing listens on, `connect()` rejects with `shared.database_unavailable` and logs `shared.database_connection_failed` at `error` with `host` and `error` (AC 3)
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-database.integration.spec.ts -t "refuses to connect when the server does not answer"`

**C5** - `start` with an unreachable `MONGO_URL` rejects with `shared.database_unavailable` and never logs `shared.server_started` (AC 3)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "does not listen when the database is unavailable"`

**C6** - With a `MONGO_URL` carrying `user:password`, no log line contains the password - on a successful connect and on a failed one (AC 4)
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-database.integration.spec.ts -t "never logs the password"`

**C7** - The connection is opened with `appName: "identity-starter"`, `serverSelectionTimeoutMS: 10000` when none is given, `bufferCommands: false` and the `autoIndex` it was given (door 2)
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-database.integration.spec.ts -t "opens the connection with the identity-starter options"`

**C8** - `start` opens a connection of its own through `createConnection`: after `start`, the global `mongoose.connection` is still `readyState` `0` (door 1)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "keeps the global mongoose connection unused"`

### S2 - Database drop and recovery visible · 2 files · 10 KB · ~3k

**C9** - When the server stops with the connection open, `MongoDatabase` logs `shared.database_disconnected` at `warn` (AC 5)
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-database.integration.spec.ts -t "logs when the connection drops and when it comes back"`

**C10** - When the server comes back, `MongoDatabase` logs `shared.database_reconnected` at `info` (AC 6)
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-database.integration.spec.ts -t "logs when the connection drops and when it comes back"`

### S3 - Shutdown without cutting requests · 4 files · 14 KB · ~4k

**C11** - `stop()` with a sign-up in flight: the sign-up still answers `201`, the database closes after it (`readyState` `0`), `shared.server_stopped` is logged and `stop()` resolves `0` (AC 7)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "finishes in-flight requests before closing the database"`

**C12** - `stop()` with a request that outlives the shutdown timeout: the open HTTP connection is closed, the database closes and `stop()` resolves `1` (AC 8)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "forces the shutdown after the timeout"`

**C13** - The HTTP shutdown waits 8000 ms when no timeout is given: with a request still in flight, it has not cut it at 7999 ms and has cut it at 8000 ms, measured on fake timers (door 4)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/http-server-shutdown.integration.spec.ts -t "waits 8 seconds by default"`

**C20** - Once `stop()` has been called, a new connection to the app's port is refused with `ECONNREFUSED` while the in-flight request is still finishing (AC 7)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "refuses new connections once stopping"`

**C14** - On `SIGTERM` and on `SIGINT`, the shutdown handler calls `stop()` once and exits with the code `stop()` resolved (AC 7)
Proof: `pnpm exec vitest run src/app/shutdown.spec.ts -t "stops and exits with the stop code on"`

**C15** - A second signal during shutdown calls neither `stop()` nor `exit` again (AC 9)
Proof: `pnpm exec vitest run src/app/shutdown.spec.ts -t "ignores a second signal during shutdown"`

### S4 - Readiness for the orchestrator · 3 files · 12 KB · ~3k

**C16** - `GET /health`, without a token and outside `/api`, answers `200` with `{ "status": "ok" }` when the readiness check is true (AC 10, door 5)
Proof: `pnpm exec vitest run src/app/create-server.e2e.spec.ts -t "answers ready when the database answers"`

**C17** - `GET /health` answers `503` with `{ "status": "unavailable" }` when the readiness check is false (AC 11, door 5)
Proof: `pnpm exec vitest run src/app/create-server.e2e.spec.ts -t "answers unavailable when the database does not"`

**C18** - `MongoDatabase.isReady()` is `true` while the server answers the `ping`, and `false` once the server is stopped, in less than the 300 ms ping timeout it was given plus 200 ms of slack (AC 10, AC 11)
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-database.integration.spec.ts -t "is ready while the server answers the ping"`
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-database.integration.spec.ts -t "is not ready once the ping does not answer in time"`

**C21** - `isReady()` waits 1000 ms for the ping when no ping timeout is given: with a ping that never answers, it has not answered at 999 ms and answers `false` at 1000 ms, measured on fake timers (AC 11)
Proof: `pnpm exec vitest run src/shared/infrastructure/mongo/mongo-database.integration.spec.ts -t "waits 1 second for the ping by default"`

### S5 - Local Mongo in one command · 2 files · 1 KB · ~1k

**C19** - `docker compose config` resolves a `mongo` service with image `mongo:8`, port `27017` published, `./.data/mongo` bind-mounted at `/data/db` with the SELinux `z` label and a healthcheck running `mongosh --eval "db.adminCommand('ping')"`; `.env.example` sets `MONGO_URL="mongodb://localhost:27017/identity-starter"`; git ignores `.data/mongo` (AC 12)
Proof: `docker compose config --format json | python3 -c "import json,sys; s=json.load(sys.stdin)['services']['mongo']; assert s['image']=='mongo:8'; assert any(p['target']==27017 and str(p['published'])=='27017' for p in s['ports']); assert any(v['type']=='bind' and v['target']=='/data/db' and v['source'].endswith('/.data/mongo') and v.get('bind',{}).get('selinux')=='z' for v in s['volumes']); assert \"db.adminCommand('ping')\" in ' '.join(s['healthcheck']['test'])"`
Proof: `grep -qx 'MONGO_URL="mongodb://localhost:27017/identity-starter"' .env.example`
Proof: `git check-ignore -q .data/mongo`

## Coverage

| Set (size)                                                | Member -> proof                                                                                                                                                               | Unproven |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `GET /health` statuses (2)                                | 200 C16 · 503 C17                                                                                                                                                             | -        |
| door 3 log events (5)                                     | `shared.database_connected` C3 · `shared.database_connection_failed` C4 · `shared.database_disconnected` C9 · `shared.database_reconnected` C10 · `shared.server_stopped` C11 | -        |
| door 2 connection options (4)                             | `appName` C7 · `serverSelectionTimeoutMS` C7 · `bufferCommands` C7 · `autoIndex` C7                                                                                           | -        |
| shutdown signals (2)                                      | `SIGTERM` C14 · `SIGINT` C14                                                                                                                                                  | -        |
| shutdown outcomes (2)                                     | finished in time -> 0 C11 · timed out -> 1 C12                                                                                                                                | -        |
| password-carrying log paths (2)                           | connected C6 · connection failed C6                                                                                                                                           | -        |
| readiness answers (2)                                     | ping answers -> true C18 · ping times out -> false C18                                                                                                                        | -        |
| default timeouts (3)                                      | server selection 10 s C7 · shutdown 8 s C13 · ping 1 s C21                                                                                                                    | -        |
| startup config: readiness behind `/health` (2 assemblies) | `start` (real `MongoDatabase`) C2 · `create-server.spec` harness C16                                                                                                          | -        |

- Claims naming a status code, route or response shape: C2, C16, C17 - each has a proof that crosses the HTTP boundary
- No other check claims more than the single case its proof exercises

## Swept

- validation: existing - `loadEnv` already refuses an empty or blank `MONGO_URL` (`src/app/config.spec.ts` "MONGO_URL empty", "MONGO_URL blank")
- failure modes: C4, C5, C12
- idempotency: C15
- authorization: n/a - `/health` is public by door 5 and exposes only `status`
- concurrency: C11, C12, C20
- data lifecycle: n/a - no collection or stored data in this feature
- dependency failure: C4, C9, C17, C18, C21
- state transitions: C9, C10, C11
- observability: C3, C4, C6, C9, C10, C11

## Handoff

- S1-S5 = ~17k across `src/shared/infrastructure/mongo`, `src/app` and `docker-compose.yml`, under the 150k budget - one builder
- **Boundary:** C1-C21 closed (uncommitted, awaiting the user's review)
- **Settled mid-build:** C13's proof moved, before any code, from `start.e2e.spec.ts` to `http-server-shutdown.integration.spec.ts`: fake timers cannot run under `start` because the Mongo driver uses them too. C11 went red on the first run - `server.close()` only closes connections idle at that moment, so a keep-alive connection that went idle after it kept the server open until Node's 5 s keep-alive timeout; `HttpServerShutdown` is now created right after `listen` and closes idle connections as each response finishes, and its unit test asserts the drain takes under 1 s. Comments trimmed across the files of this session at the user's request. Verification round 1 FAILed C11 and C18: C11's text said `200` while its proof is a sign-up that answers `201` - the check text was wrong and the assertion right, so the text now says `201`; C18 asserted the `false` but not the time, so its test now measures it, and C21 covers the 1 s default the checks had left out. C20 was added because AC 7's "stop accepting connections" was proven only at the unit level. After review, the user asked for the Mongo data to live inside the repository, ignored by git: AC 12 and C19 moved from a named volume to the `./.data/mongo` bind mount (with the `z` label SELinux needs), and `.data` joined `.gitignore`
- **Abandoned:** none
