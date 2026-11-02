# API container checks

Profile: light
Plan: `.specs/features/api-container/plan.md`

14 checks in 3 slices · 3 one-way doors · 0 open, of which 0 block

## Checks

Grouped by the plan's slices; numbering runs across the whole feature. Every proof is a shell
command run from the project root in `bash`; the Docker proofs run in order (C4 builds the image
the later ones read, C9 starts the containers C10 and C8 use).

### S1 - `pnpm build` produces a bundle that runs · 2 files · 3 KB · ~1k

**C1** - `pnpm build` from a tree without `dist/` exits 0 and writes a non-empty `dist/main.js` and `dist/main.js.map` (AC 1)
Proof: `rm -rf dist && pnpm build && test -s dist/main.js && test -s dist/main.js.map`

**C2** - Every import in `dist/main.js` is a `node:` module or a package listed in `dependencies` (or a subpath of one); no `@shared/`, `@app/`, `@/` or relative import is left (AC 2)
Proof: `node -e 'const deps=Object.keys(require("./package.json").dependencies);const src=require("fs").readFileSync("dist/main.js","utf8");const specs=[...src.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*"([^"]+)"/g)].map((m)=>m[1]);const bad=specs.filter((s)=>!s.startsWith("node:")&&!deps.some((d)=>s===d||s.startsWith(d+"/")));if(specs.length===0||bad.length>0){console.error(bad);process.exit(1)}'`

**C3** - With an invalid environment (`JWT_SECRET=short` and nothing else), `node --enable-source-maps dist/main.js` exits 1 and its output cites `src/app/config.ts` and no `dist/main.js:` frame (AC 3)
Proof: `out=$(env -i PATH="$PATH" JWT_SECRET=short node --enable-source-maps dist/main.js 2>&1); code=$?; test "$code" -eq 1 && grep -q "src/app/config.ts" <<<"$out" && ! grep -q "dist/main.js:" <<<"$out"`

**C11** - `esbuild` is in `devDependencies` at `^0.28.2` and the `build` script is the literal of Landing door 1 (Landing door 1)
Proof: `test "$(node -p "require('./package.json').devDependencies.esbuild")" = "^0.28.2"`
Proof: `test "$(node -p "require('./package.json').scripts.build")" = "esbuild src/main.ts --bundle --platform=node --format=esm --target=node24 --packages=external --sourcemap --outfile=dist/main.js"`

### S2 - The image runs the API · 3 files · 4 KB · ~1k

**C4** - `docker build -t identity-starter-api .` builds the image and exits 0 (AC 4)
Proof: `docker build -t identity-starter-api .`

**C5** - The container runs as uid 1000 (AC 5)
Proof: `test "$(docker run --rm --entrypoint id identity-starter-api -u)" = "1000"`

**C6** - `/app/node_modules/.pnpm` exists and `/app/node_modules` holds none of `vitest`, `tsx`, `esbuild`, `mongodb-memory-server`, neither linked at the top nor in `.pnpm` (AC 6)
Proof: `docker run --rm --entrypoint sh identity-starter-api -c 'cd /app/node_modules && test -d .pnpm && for p in vitest tsx esbuild mongodb-memory-server; do test ! -e "$p" || exit 1; if ls .pnpm | grep -q "^$p@"; then exit 1; fi; done'`

**C7** - The image has no `/app/src`, `/app/.env`, `/app/web` nor `/app/.git` (AC 7)
Proof: `docker run --rm --entrypoint sh identity-starter-api -c 'test ! -e /app/src && test ! -e /app/.env && test ! -e /app/web && test ! -e /app/.git'`

**C12** - The image is the slim Debian base with Node 24 (no `git`, `gcc`, `python3` nor `curl`, which the full `node:24` image ships), user `node`, workdir `/app`, port 3000 exposed and command `node --enable-source-maps dist/main.js`; its `node_modules` was installed by pnpm 12.9.1 without development dependencies and holds no dependency that only `web/` declares; the `Dockerfile` builds both stages from `node:24-slim` (the build and production-dependency stages derive from `base`), enables corepack and installs twice with `--frozen-lockfile --ignore-scripts` and `--filter identity-starter` (Landing door 2)
Proof: `test "$(docker image inspect identity-starter-api --format '{{.Config.User}} {{.Config.WorkingDir}} {{json .Config.Cmd}} {{json .Config.ExposedPorts}}')" = 'node /app ["node","--enable-source-maps","dist/main.js"] {"3000/tcp":{}}'`
Proof: `docker run --rm --entrypoint sh identity-starter-api -c '. /etc/os-release && test "$ID" = debian && node --version | grep -q "^v24\." && ! command -v git && ! command -v gcc && ! command -v python3 && ! command -v curl'`
Proof: `docker run --rm --entrypoint node identity-starter-api -e 'const m=JSON.parse(require("fs").readFileSync("/app/node_modules/.modules.yaml","utf8"));process.exit(m.packageManager==="pnpm@12.9.1"&&m.included.dependencies===true&&m.included.devDependencies===false?0:1)'`
Proof: `docker run --rm --entrypoint ls identity-starter-api /app/node_modules/.pnpm | node -e 'const have=require("fs").readFileSync(0,"utf8").split("\n");const root=require("./package.json");const web=require("./web/package.json");const rootDeps=new Set(Object.keys({...root.dependencies,...root.devDependencies}));const webOnly=Object.keys({...web.dependencies,...web.devDependencies}).filter((d)=>!rootDeps.has(d));const leaked=webOnly.filter((d)=>have.some((entry)=>entry.startsWith(d.replace("/","+")+"@")));process.exit(webOnly.length>0&&leaked.length===0?0:1)'`
Proof: `test "$(grep -c "^FROM node:24-slim" Dockerfile)" = "2" && grep -qx "FROM base AS build" Dockerfile && grep -qx "FROM base AS production-dependencies" Dockerfile && grep -qx "RUN corepack enable" Dockerfile && test "$(grep -c -- "--frozen-lockfile --ignore-scripts.*--filter identity-starter$" Dockerfile)" = "2"`

### S3 - Compose brings the whole system up · 2 files · 6 KB · ~2k

**C9** - `docker compose --profile app up -d --wait mongo redis api` exits 0 (all three healthy) and `GET http://localhost:3000/health` answers exactly `200` with `{"status":"ok"}` (AC 9)
Proof: `docker compose --profile app up -d --wait mongo redis api && test "$(curl -s -w ' %{http_code}' http://localhost:3000/health)" = '{"status":"ok"} 200'`

**C10** - A sign-up through the container's API answers `201`, and the compose Mongo then holds exactly one account with that e-mail (AC 10)
Proof: `email="container-check-$(date +%s%N)@example.com"; test "$(curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/auth/sign-up -H 'content-type: application/json' -d "{\"name\":\"Container Check\",\"email\":\"$email\",\"password\":\"container-check-password-123\"}")" = "201" && test "$(docker compose exec -T mongo mongosh --quiet identity-starter --eval "db.accounts.countDocuments({ email: \"$email\" })")" = "1"`

**C8** - `docker compose --profile app stop api` ends the container with exit code 0, and the log of that run (since its `StartedAt`) holds `shared.server_stopped` (AC 8)
Proof: `docker compose --profile app stop api && id="$(docker compose --profile app ps -aq api)" && test "$(docker inspect -f '{{.State.ExitCode}}' "$id")" = "0" && docker logs --since "$(docker inspect -f '{{.State.StartedAt}}' "$id")" "$id" 2>&1 | grep -q "shared.server_stopped"`

**C13** - Without the `app` profile the compose services are exactly `bugsink`, `mongo` and `redis`; with it, `api` is among them (AC 11)
Proof: `test "$(docker compose config --services | sort | tr '\n' ' ')" = "bugsink mongo redis " && docker compose --profile app config --services | grep -qx api`

**C14** - The `api` service is the literal of Landing door 3: profile `app`; built from the project root with `Dockerfile`; `env_file: .env` (its variables, such as `JWT_SECRET`, reach the service environment); `MONGO_URL` with `directConnection=true` on host `mongo`; `REDIS_URL` `redis://redis:6379`; `PORT` `3000`; one port, `3000:3000` with no host IP; waiting for exactly `mongo` and `redis` healthy; healthcheck `node -e` fetching `http://localhost:3000/health` and exiting by `response.ok` (Landing door 3)
Proof: `docker compose --profile app config --format json | node -e 'const a=JSON.parse(require("fs").readFileSync(0,"utf8")).services.api;const e=a.environment;const h=a.healthcheck.test;const ok=JSON.stringify(a.profiles)==="[\"app\"]"&&a.build.context===process.cwd()&&a.build.dockerfile==="Dockerfile"&&"JWT_SECRET" in e&&e.MONGO_URL==="mongodb://mongo:27017/identity-starter?directConnection=true"&&e.REDIS_URL==="redis://redis:6379"&&e.PORT==="3000"&&a.ports.length===1&&String(a.ports[0].published)==="3000"&&a.ports[0].target===3000&&a.ports[0].host_ip===undefined&&Object.keys(a.depends_on).sort().join()==="mongo,redis"&&a.depends_on.mongo.condition==="service_healthy"&&a.depends_on.redis.condition==="service_healthy"&&JSON.stringify(h.slice(0,3))==="[\"CMD\",\"node\",\"-e\"]"&&h[3].includes("fetch(\x27http://localhost:3000/health\x27)")&&h[3].includes("process.exit(response.ok ? 0 : 1)");process.exit(ok?0:1)'`
Proof: `grep -qx "    env_file: .env" docker-compose.yml`

## Coverage

| Set (size)                                         | Member -> proof                                                    | Unproven |
| -------------------------------------------------- | ------------------------------------------------------------------ | -------- |
| build outputs (2)                                  | `dist/main.js` C1 · `dist/main.js.map` C1                          | -        |
| import kinds allowed in the bundle (2)             | `node:` modules C2 · `dependencies` packages C2                    | -        |
| development dependencies kept out (4)              | `vitest` C6 · `tsx` C6 · `esbuild` C6 · `mongodb-memory-server` C6 | -        |
| paths kept out of the image (4)                    | `src/` C7 · `.env` C7 · `web/` C7 · `.git` C7                      | -        |
| services healthy with the `app` profile (3)        | `mongo` C9 · `redis` C9 · `api` C9                                 | -        |
| `api` without and with the profile (2)             | without C13 · with C13                                             | -        |
| startup config: container environment (1 assembly) | the compose `api` service C14, exercised by C9 and C10             | -        |

- Claims naming a status code or response shape: C9, C10 - each proof crosses the real HTTP boundary of the running container
- No other check claims more than the single case its proof exercises

## Swept

- validation: n/a - no new input; the environment is validated by `loadEnv` as before, and C3 shows the refusal still works inside the bundle
- failure modes: C3, C8
- idempotency: n/a - nothing is retried or replayed
- authorization: C5, C7
- concurrency: n/a - one container, one process; nothing new runs in parallel
- data lifecycle: n/a - no stored-data change; Mongo keeps its data in the host bind mount `./.data/mongo`
- dependency failure: C9, C14
- state transitions: n/a - no state machine
- observability: C3, C8

## Handoff

- S1-S3 = ~13 KB across 7 files (`Dockerfile`, `.dockerignore`, `docker-compose.yml`, `package.json` and the docs; `wc -c`, /4) ≈ 4k, under the 150k budget - one builder
- **Boundary:** C1-C14 closed (uncommitted, awaiting the user's review; base `9424e70`)
- **Settled mid-build:** the English `plan.md` corrects two facts of the approved pt-BR copy - the sign-up route is `POST /api/auth/sign-up`, and AC 11 says `api` does not start without the profile, because `bugsink` now starts by default since `error-tracking`; a kept-true `Impact` row records that a `SENTRY_DSN` on `localhost:8000` does not reach Bugsink from inside the container. The Docker proofs start `mongo`, `redis` and `api` by name, so the Bugsink image is never pulled. `.dockerignore` is an allow-list (`package.json`, the lockfile, `pnpm-workspace.yaml`, `tsconfig.json`, `src` without specs and `testing/`, `web/package.json` for the workspace); both installs use `--ignore-scripts --filter identity-starter`, which skips husky's `prepare` and `mongodb-memory-server`'s binary download while `argon2` still loads its prebuilt binary. C10 left one `container-check-<timestamp>@example.com` account in the local `identity-starter` database; the compose services were stopped (not removed) after the proofs, as they were before
- **Abandoned:** nothing
- **Settled after verification round 1:** round 1 failed C12 and C14 on precision - their proofs did not reach every part of Landing doors 2 and 3 (a full `node:24` base or a `["CMD","true"]` healthcheck would have passed). C12 now also proves the slim base (no `git`, `gcc`, `python3`, `curl`), pnpm 12.9.1 without development dependencies from `.modules.yaml`, and the `Dockerfile` literals; C14 also proves the build context and file, `env_file` (a `.env`-only variable reaches the service), the port target and the healthcheck command and URL. The minor notes were folded in too: C6 asserts `.pnpm` exists, C8 reads only the log of the stopped run, C9 asserts the exact `200`, C13 asserts the exact service list without the profile. Claims grew; none shrank
- **Settled after verification round 2:** round 2 failed C12 only: nothing proved "only the root package's production dependencies" - dropping `--filter identity-starter` let `preact` from `web/` into the image with every proof green. C12 now requires `--filter identity-starter` on both installs, the build and production-dependency stages deriving from `base`, and no `web/`-only dependency in the image's `.pnpm`; C14 now also refuses a host IP on the port, an extra `depends_on` and a healthcheck that does not exit by `response.ok`
