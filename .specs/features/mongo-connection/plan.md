# Mongo Connection

## Problem

The app only runs on in-memory adapters: every piece of data is lost when the process restarts,
and step 4 (Mongoose repositories) has no connection to register its models on. Today nothing
decides what happens when Mongo is not up at startup, when it goes down while the app runs, or
when the deploy sends `SIGTERM`: the process dies in the middle of in-flight requests, leaves
connections open, and nobody finds out from the log.

No evidence beyond the code: there is no deploy and no user yet.

When this ships, the process only accepts requests after connecting to Mongo; if Mongo does not
answer at startup, it exits with code 1 and a log saying why; Mongo going down and coming back
shows in the log; the deploy stops the process without cutting requests; and `GET /health` tells
whoever orchestrates whether the app is ready.

## Flow

Reuses `start`, `loadEnv` (`MONGO_URL` already exists), `PinoLogger` with `defineLogEvent`,
`AppError` and `createServer`, instead of creating another bootstrap or another logger.

1. `main.ts` (exists) calls `start` (exists, `src/app/start.ts`) with the `env`
2. `start` creates `MongoDatabase` (new, door 1, `src/shared/infrastructure/mongo`) with `env.MONGO_URL` and awaits `connect()` - `mongoose.createConnection(url, door 2 options).asPromise()`
3. `MongoDatabase` wires the connection events to the `Logger` (exists) with the `shared.database_*` events (door 3)
4. only once the connection is open, `createServer` (exists) receives `MongoDatabase` for the `GET /health` route (door 5) and `start` calls `listen`
5. `start` returns `{ port, stop }`; `handleShutdownSignals` (new, no door - placement, `src/app/shutdown.ts`) turns `SIGTERM`/`SIGINT` into one `stop()`: `HttpServerShutdown` (new, no door - placement, `src/shared/infrastructure/http`) closes HTTP and waits for in-flight requests (door 4), then the Mongo connection closes and the process exits with the code `stop()` resolved

## Impact

| Front             | What changes                                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| domain            | new term: `MongoDatabase` - owner of the process's single Mongoose connection; lives in `src/shared/infrastructure/mongo`                                               |
| domain            | new log events `shared.database_connected`, `shared.database_disconnected`, `shared.database_reconnected`, `shared.database_connection_failed`, `shared.server_stopped` |
| domain            | new error `SharedError.DatabaseUnavailable` (`shared.database_unavailable`) - startup could not connect                                                                 |
| internal contract | `start` returns the Node `Server` today; it returns `{ port, stop }` instead - only `main.ts` and `start.e2e.spec.ts` use it                                            |
| local environment | `pnpm dev` now needs a running Mongo; a new `docker-compose.yml` starts one and keeps its data in `./.data/mongo`, ignored by git                                       |
| stored data       | nothing to migrate - no collection exists yet                                                                                                                           |

## Relations

None - no stored-data shape change; the models arrive in step 4.

## Surface

| Route         | In  | Out      | Status   |
| ------------- | --- | -------- | -------- |
| `GET /health` | -   | `status` | 200, 503 |

## Landing

| One-way door                                                                            | Literal shape                                                                                                                                                                                       | Alternative rejected                                                                                                                                  |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Connection owner                                                                     | `MongoDatabase` holds one `mongoose.createConnection(url, options)`; step 4 repositories receive `database.connection` and register with `connection.model(...)`                                    | global `mongoose.connect` + `mongoose.model` - hidden global state, and a test cannot point the same model at another database nor run in parallel    |
| 2. Connection options (precedent)                                                       | `{ appName: "identity-starter", serverSelectionTimeoutMS: 10_000, bufferCommands: false, autoIndex: NODE_ENV !== "prod" }`                                                                          | the default `bufferCommands: true` - a model used before `connect` queues silently and only fails 10 s later, instead of failing at once              |
| 3. Log events (read in Loki)                                                            | `shared.database_connected` `{ host, database }` · `shared.database_disconnected` · `shared.database_reconnected` · `shared.database_connection_failed` `{ host, error }` · `shared.server_stopped` | logging the `MONGO_URL` - it carries user and password                                                                                                |
| 4. Shutdown                                                                             | `SIGTERM`/`SIGINT` → `server.close()` → wait up to 8 s → `connection.close()` → exit 0; past 8 s → close the open HTTP connections, close Mongo and exit 1                                          | `process.exit` straight on the signal - cuts requests mid-way; 8 s stays under the 10 s `docker stop` waits before `SIGKILL`                          |
| 5. Readiness route                                                                      | `GET /health` outside `/api`, no token, `200 { "status": "ok" }` · `503 { "status": "unavailable" }`                                                                                                | inside `/api` with problem details - orchestrators and load balancers check the status and a plain body, and the route is not part of the product API |
| 2b. Index creation (supersedes the `autoIndex` part of door 2, user request 2026-10-24) | `autoIndex: true` in every environment, and `start` awaits `IdentityModels.ready()` (`Model.init()` on every model) before `listen`                                                                 | `autoIndex` off in `prod` plus an explicit `syncIndexes()` - one more startup step to forget, and `syncIndexes` drops indexes it does not know        |

- Nothing else in this change is hard to reverse

## Criteria

### S1: Start only with the database connected (P1)

The process opens the connection before accepting requests, or it does not start.

**Acceptance Criteria**

1. WHEN `start` is called with a `MONGO_URL` that answers THEN the system SHALL open the connection before listening on the port, with `readyState` equal to `1` when `start` resolves
2. WHEN the connection opens THEN the system SHALL log `shared.database_connected` at `info` with `host` and `database`
3. IF Mongo does not answer within `serverSelectionTimeoutMS` (10 s by default) THEN `start` SHALL reject with `shared.database_unavailable`, log `shared.database_connection_failed` at `error` and SHALL NOT listen on any port
4. IF the `MONGO_URL` carries a user and password THEN no log line SHALL contain the password

**Independent test:** `start` against a `mongodb-memory-server` and against a port nothing listens on.

### S2: Database drop and recovery visible (P1)

Mongo going down while the app runs shows in the log, and so does its return.

**Acceptance Criteria**

5. WHEN the open connection drops THEN the system SHALL log `shared.database_disconnected` at `warn`
6. WHEN the connection comes back THEN the system SHALL log `shared.database_reconnected` at `info`

**Independent test:** stop and restart the `mongodb-memory-server` with the app connected.

### S3: Shutdown without cutting requests (P1)

The deploy stops the process cleanly.

**Acceptance Criteria**

7. WHEN the process receives `SIGTERM` or `SIGINT` THEN the system SHALL stop accepting connections, finish the in-flight requests, close the Mongo connection, log `shared.server_stopped` and exit with code `0`
8. IF the in-flight requests do not finish within 8 s THEN the system SHALL close the open HTTP connections, close the Mongo connection and exit with code `1`
9. IF a second signal arrives during shutdown THEN the system SHALL NOT start a second shutdown

**Independent test:** a slow request in flight, `stop()` called in the middle: the request finishes and the connection closes after it.

### S4: Readiness for the orchestrator (P2)

Whoever orchestrates knows whether the app can serve.

**Acceptance Criteria**

10. WHEN `GET /health` is called with Mongo answering the `ping` THEN the system SHALL answer `200` with `{ "status": "ok" }`
11. IF Mongo does not answer the `ping` within 1 s THEN `GET /health` SHALL answer `503` with `{ "status": "unavailable" }`

**Independent test:** `GET /health` with the database up and after stopping the `mongodb-memory-server`.

### S5: Local Mongo in one command (P2)

**Acceptance Criteria**

12. The `docker-compose.yml` SHALL declare a `mongo` service with the `mongo:8` image, port `27017` published, the data in `./.data/mongo` inside the repository (bind mount, ignored by git) and a healthcheck with `mongosh --eval "db.adminCommand('ping')"`, and the `MONGO_URL` in `.env.example` SHALL point at it

**Independent test:** `docker compose config` valid, then `docker compose up -d` followed by `pnpm dev`.

## Out of scope

| Excluded                                          | Why                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Mongoose repositories and indexes                 | step 4; this delivers the connection they register on                                |
| Transactions and replica set                      | they come with the outbox, as NEXT-STEPS at `eccf67d` says                           |
| Own retry loop at startup                         | the driver already keeps selecting a server for the whole `serverSelectionTimeoutMS` |
| Pool metrics and tracing                          | OpenTelemetry is planned separately                                                  |
| Liveness separate from readiness (`/health/live`) | one endpoint is enough until an orchestrator tells the two apart                     |

## Assumptions

| Assumption                                      | Chosen default                                                                            | Rationale                                                                                         | Confirmed? |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------- |
| Wire into `start` now or only create the module | wire it: connect at startup, clean shutdown and `docker-compose.yml` in this feature      | a connection nobody opens or closes cannot be robust; shutdown is where it gets tested            | y          |
| Include `GET /health`                           | include it                                                                                | without readiness, the orchestrator sends traffic to a process that lost the database             | y          |
| Timeouts configurable through env               | constants in the code (10 s startup, 8 s shutdown, 1 s ping); tests inject smaller values | no environment asks for different values yet; an empty env var is more configuration to get wrong | y          |
| `start` keeps refusing `NODE_ENV=prod`          | keeps refusing: the repositories are still in memory                                      | connecting to Mongo does not make the fakes safe for production                                   | y          |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface                | Decision                       | Landing                                                                              |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| API `GET /health`      | response shape                 | AC 10, 11 and door 5                                                                 |
| API `GET /health`      | error shape                    | AC 11 - plain body, not problem details (door 5)                                     |
| API `GET /health`      | who may call it                | door 5 - no token; exposes nothing beyond `status`                                   |
| API `GET /health`      | versioning and rate limit      | n/a - operational route outside `/api`; rate limiting is the adapter's, out of scope |
| process (`pnpm start`) | output format                  | existing - `PinoLogger` JSON lines; door 3 events                                    |
| process (`pnpm start`) | exit codes                     | AC 3, 7, 8                                                                           |
| process (`pnpm start`) | what it prints failing halfway | AC 3 and 8                                                                           |
| process (`pnpm start`) | flags and defaults             | n/a - no flags; the env is already validated by `loadEnv`                            |

## Sources

- User request (2026-10-24): "crie o mongo connect, mas quero algo robusto"; plan approved in pt-BR with the recommended defaults
- `NEXT-STEPS.md` at commit `eccf67d` (removed in `f248595`), step 4, and `.claude/skills/STACK.md` "Data" - Mongoose, schemas only in adapters
