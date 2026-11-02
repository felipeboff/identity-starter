# API container

## Problem

The API only runs on a machine with Node 24, pnpm and the development dependencies installed,
started by `tsx`, which transpiles TypeScript at run time (`pnpm start`). There is no artifact to
publish to the EC2/VPS that `STACK.md` plans, and `docker compose` brings up only the backing
services, so nobody can bring the whole system up with one command. Who pays: whoever deploys
(there is no image) and whoever wants to use the backend without the Node toolchain, such as
someone working only on `web/`.

There is no evidence beyond the `NEXT-STEPS.md` item, section 4.

When this ships: `pnpm build` produces `dist/main.js`; `docker build .` produces an image that runs
`node` on that bundle, with production dependencies only and no root;
`docker compose --profile app up -d --wait` brings up Mongo, Redis and the API, healthy on
`GET /health`; `docker compose up -d --wait` (and `pnpm docker:up`) keep not starting the API.

## Flow

Reuses `src/main.ts`, `start` and the `/health` route as they are; adds only the build and the
container.

1. `pnpm build` -> esbuild (door 1) bundles `src/main.ts` and our modules into `dist/main.js` + `dist/main.js.map`, leaving every package import external
2. `Dockerfile` (door 2): the build stage installs with the frozen lockfile and runs `pnpm build`; the final stage on `node:24-slim` copies `dist/` and the production `node_modules`, user `node`, `CMD ["node", "--enable-source-maps", "dist/main.js"]`
3. `docker-compose.yml` (exists) gains the `api` service under the `app` profile (door 3): built from `.`, `env_file: .env`, with `MONGO_URL`, `REDIS_URL` and `PORT` pointing at the `mongo` and `redis` services, waiting for both to be healthy, port 3000, healthcheck on `GET /health`
4. out: the same app as `pnpm start`, reading the environment of the container instead of `--env-file`

## Impact

| Front       | What changes                                                                                                                                                                                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dependency  | `esbuild` comes into `devDependencies` (door 1); 0.28.2 is already in the tree through `tsx`                                                                                                                                                                                                                  |
| scripts     | new `build`; `start` and `dev` stay as they are                                                                                                                                                                                                                                                               |
| files       | new `Dockerfile` and `.dockerignore`; `dist/` is already in `.gitignore`                                                                                                                                                                                                                                      |
| compose     | new `api` service under the `app` profile; `mongo`, `redis` and `bugsink` do not change                                                                                                                                                                                                                       |
| behaviour   | inside the container the Mongo URL uses `directConnection=true` (`mongodb://mongo:27017/identity-starter?directConnection=true`): the replica set member is registered as `localhost:27017`, which inside the container would be the API itself; transactions keep working because the only member is primary |
| behaviour   | in the container a stack trace points at `src/**/*.ts` (`--enable-source-maps` + `dist/main.js.map`), which also holds for what reaches Sentry                                                                                                                                                                |
| behaviour   | found after approval: a `SENTRY_DSN` that points at the local Bugsink (`http://<key>@localhost:8000/1`) does not reach it from inside the `api` container, where `localhost` is the API itself; the container then sends nowhere, silently, until the DSN names a host the container can reach                |
| docs        | new ADR (esbuild bundle in a `node:24-slim` image); `STACK.md` "Delivery" mentions the image; the `NEXT-STEPS.md` item becomes `[x]` and the "Para rodar" note mentions the `app` profile                                                                                                                     |
| stored data | nothing to migrate                                                                                                                                                                                                                                                                                            |

## Relations

None - no stored-data shape change.

## Surface

None - nothing consumed outside. No route changes; the container exposes the same API on port 3000.

## Landing

| One-way door       | Literal shape                                                                                                                                                                                                                                                                                                                                                                        | Alternative rejected                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Build tool      | `"esbuild": "^0.28.2"` in `devDependencies`; `"build": "esbuild src/main.ts --bundle --platform=node --format=esm --target=node24 --packages=external --sourcemap --outfile=dist/main.js"`                                                                                                                                                                                           | `tsx` in the image - the user's choice: bundle; a transpiler in production and `tsx` would move to `dependencies`; `tsc` with `tsconfig.build.json` - emits the `@shared/` and `@/` aliases unchanged, and Node cannot resolve them without another tool (`tsc-alias`); bundling `node_modules` too - breaks `argon2`'s native binary and `pino`'s transports, which load files by path |
| 2. Image           | multi-stage on `node:24-slim`; pnpm 12.9.1 through corepack (from `packageManager`); `pnpm install --frozen-lockfile`; final stage with only the root package's production dependencies, `USER node`, `WORKDIR /app`, `EXPOSE 3000`, `CMD ["node", "--enable-source-maps", "dist/main.js"]`                                                                                          | `node:24-alpine` - musl differs from the glibc of the development machine (DNS resolution, `getaddrinfo`), so a bug may show up only in the container; distroless - no shell to investigate and no corepack; running as root - the base image default, unnecessary for a process that only listens on 3000                                                                              |
| 3. Compose service | `api: { profiles: ["app"], build: ".", env_file: ".env", environment: { MONGO_URL: "mongodb://mongo:27017/identity-starter?directConnection=true", REDIS_URL: "redis://redis:6379", PORT: "3000" }, ports: ["3000:3000"], depends_on: { mongo: { condition: service_healthy }, redis: { condition: service_healthy } }, healthcheck: node + fetch on http://localhost:3000/health }` | a service with no profile - `docker compose up` (and `pnpm docker:up`) would start the API too and take port 3000 from `pnpm dev`; `replicaSet=rs0` in the container URL - the member is registered as `localhost:27017`, which inside the container is the API itself                                                                                                                  |

- Nothing else in this change is hard to reverse

## Criteria

### S1: `pnpm build` produces a bundle that runs (P1)

The code becomes one file that `node` runs with no transpiler.

**Acceptance Criteria**

1. WHEN `pnpm build` runs THEN it SHALL write `dist/main.js` and `dist/main.js.map` and exit with code 0
2. The bundle SHALL NOT import an `@shared/`, `@app/` or `@/` path nor a file from `src/`, and SHALL import only packages listed in `dependencies` and `node:` modules
3. IF the environment is invalid THEN `node --enable-source-maps dist/main.js` SHALL exit with code 1 with a stack trace that cites `src/app/config.ts`, not `dist/main.js`

**Independent test:** `pnpm build` followed by `JWT_SECRET=short node --enable-source-maps dist/main.js` exits with 1 and the stack cites `src/app/config.ts`.

### S2: The image runs the API (P1)

A publishable artifact, lean and without root.

**Acceptance Criteria**

4. WHEN `docker build -t identity-starter-api .` runs THEN it SHALL build the image and exit with code 0
5. The container SHALL run as the `node` user (uid 1000)
6. The image SHALL NOT contain development dependencies: `vitest`, `tsx`, `esbuild` and `mongodb-memory-server` absent from `/app/node_modules`
7. The image SHALL NOT contain `src/`, `.env`, `web/` nor `.git`
8. WHEN the container receives `SIGTERM` (`docker compose stop api`) THEN it SHALL end with code 0 after logging `shared.server_stopped`

**Independent test:** `docker build` finishes and `docker run --rm --entrypoint id identity-starter-api -u` prints `1000`.

### S3: Compose brings the whole system up (P1)

One command brings up the database, the cache and the API talking to each other.

**Acceptance Criteria**

9. WHEN `docker compose --profile app up -d --wait` runs THEN `mongo`, `redis` and `api` SHALL be healthy and `GET http://localhost:3000/health` SHALL answer `200` `{ "status": "ok" }`
10. WHEN a sign-up goes through the container's API (`POST /api/auth/sign-up`) THEN it SHALL answer `201`, writing to the compose Mongo inside a transaction
11. WHEN `docker compose up -d --wait` runs without the profile THEN `api` SHALL NOT start (`mongo`, `redis` and `bugsink` do, the last one since the `error-tracking` feature)

**Independent test:** `docker compose --profile app up -d --wait` and `curl -fs localhost:3000/health`.

## Out of scope

| Excluded                                                 | Why                                                               |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| publishing the image to a registry and building it in CI | CI on GitHub Actions is its own item (`NEXT-STEPS.md`, section 4) |
| production compose, Terraform, reverse proxy, TLS        | production infrastructure is still _planned_ in `STACK.md`        |
| a container for `web/`                                   | the item is about the API                                         |
| hot reload inside the container                          | development stays on `pnpm dev` on the host                       |
| multi-architecture image                                 | no deploy target is defined yet                                   |

## Assumptions

Defaults that are not already a numbered criterion. Drop a row once it is.

| Assumption            | Chosen default                                                                    | Rationale                                                                             | Confirmed? |
| --------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------- |
| container environment | the same `.env` (`env_file`), overriding only `MONGO_URL`, `REDIS_URL` and `PORT` | one place for secrets and OAuth; only the addresses change inside the compose network | y          |
| `start` script        | stays on `tsx`                                                                    | the production path is the container; changing `start` touches the development flow   | y          |
| `tsconfig.build.json` | stays as it is                                                                    | it already exists and is unused; removing it is another cleanup                       | y          |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface                                             | Decision                              | Landing                                                                         |
| --------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------- |
| command `pnpm build`                                | output, exit codes                    | AC 1                                                                            |
| command `pnpm build`                                | flags and defaults                    | n/a - no flags; the script fixes every esbuild option                           |
| command `pnpm build`                                | what it prints when it fails midway   | existing - esbuild prints the error with file and line and exits non-zero       |
| command `docker compose --profile app up -d --wait` | exit codes, what it prints on failure | AC 9, existing - `--wait` exits non-zero when a service does not become healthy |
| command `node dist/main.js`                         | what it prints when it fails midway   | AC 3                                                                            |

## Sources

- `NEXT-STEPS.md`, section 4 - "API Dockerfile and a service in `docker-compose.yml`"; the user chose the esbuild bundle in this conversation
- `.claude/skills/STACK.md`, "Delivery" - Docker + Docker Compose
