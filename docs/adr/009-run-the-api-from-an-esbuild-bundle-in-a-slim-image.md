# ADR-009: Run the API From an esbuild Bundle in a `node:24-slim` Image

- **Date**: 2026-10-31
- **Status**: Accepted
- **Deciders**: Felipe Boff
- **Tags**: delivery, docker, build

## Context and Problem Statement

The API only ran through `tsx`, which transpiles TypeScript at run time, on a machine with the
development dependencies installed. There was no artifact to deploy to the EC2/VPS that `STACK.md`
plans, and `docker compose` did not start the API. `tsc` cannot be the build on its own: it emits
the `@shared/`, `@app/` and `@/` aliases unchanged, and Node does not resolve them.

## Decision Drivers

- Plain `node` in production, with no transpiler
- An image with production dependencies only, not running as root
- Stack traces that still point at `src/**/*.ts`, for the logs and for Sentry
- `docker compose up` keeps serving `pnpm dev` on the host

## Considered Options

- An esbuild bundle of our code, with every package left external
- `tsx` inside the image
- `tsc` plus an alias rewriter (`tsc-alias`)

## Decision Outcome

Chosen option: **the esbuild bundle**. `pnpm build` runs
`esbuild src/main.ts --bundle --platform=node --format=esm --target=node24 --packages=external --sourcemap --outfile=dist/main.js`:
the aliases are resolved, our code becomes one file, and `node_modules` stays outside the bundle
(so `argon2`'s native binary and `pino`'s transports keep loading by path).

The `Dockerfile` is multi-stage on `node:24-slim`: pnpm 12.9.1 through corepack,
`pnpm install --frozen-lockfile --ignore-scripts --filter resolve-hub` to build, a separate
`--prod` install for the final stage, which holds only `package.json`, `node_modules` and `dist/`,
runs as `node` and starts `node --enable-source-maps dist/main.js`.

`docker-compose.yml` gains an `api` service under the `app` profile, reading `.env` and overriding
`MONGO_URL` (`mongodb://mongo:27017/resolve-hub?directConnection=true`), `REDIS_URL` and `PORT`.
`directConnection=true` is needed because the replica set member is registered as
`localhost:27017`, which inside the container is the API itself.

### Positive Consequences

- One publishable image; `docker compose --profile app up -d --wait` brings up the whole backend
- No transpiler and no development dependency in production
- Source maps keep stack traces on the TypeScript files

### Negative Consequences

- Two ways to run locally (`pnpm dev` and the container) that must stay equivalent
- The image is about 480 MB, mostly production dependencies (`@sentry/node` brings Babel)
- Inside the container, a `SENTRY_DSN` pointing at the local Bugsink through `localhost` reaches
  nothing

## Pros and Cons of the Options

### esbuild bundle ✅ Chosen

- ✅ Resolves the aliases from `tsconfig.json` with no extra tool; builds in milliseconds
- ✅ Leaves packages external, so native and path-loaded modules work
- ❌ Type-checking stays a separate step (`pnpm typecheck`)

### `tsx` in the image

- ✅ No build step
- ❌ A transpiler in production; `tsx` would move to `dependencies`

### `tsc` plus `tsc-alias`

- ✅ Uses the TypeScript compiler itself
- ❌ One more tool to rewrite what esbuild already resolves

## Links

- `.specs/features/api-container/plan.md`
- `.claude/skills/STACK.md`, "Delivery"
