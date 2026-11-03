# Identity Starter

A backend API boilerplate focused on authentication. Clone it, set a few environment variables
and you start with sign-up, sign-in, OAuth, sessions, password reset, e-mail verification,
invitations and permissions already working, tested and documented, so the next commit can be
about your product.

Node.js, TypeScript, Express, MongoDB and Redis, with a Preact front end in `web/` that covers
every route.

## What is included

**Authentication**

- Sign-up and sign-in with e-mail and password (argon2id, 12 to 128 characters)
- OAuth sign-in with Google and GitHub, with PKCE; link and unlink providers on an existing account
- Short-lived JWT access tokens (15 min) and refresh tokens (30 days) rotated on every use
- Refresh token reuse detection: reusing a rotated token revokes every session of the account

**Account**

- E-mail verification, sent on sign-up and on request
- Password reset and password change
- E-mail change, confirmed from the new address, with a notice to the old one
- Welcome e-mail on every account created, sent by the `notifications` module
- Profile name update; account deactivation and reactivation

**Sessions**

- Many sessions per account, each with IP and user agent
- List your sessions (the current one is marked), sign out of one, or of all the others
- Revocation ends the session for good, with a reason (`logout`, `security`, `email_changed`, ...)

**Access control**

- Each account has a membership with a role (`user`, `admin`) and a list of permissions
- Every use case declares its access: anyone, any member, or the permissions and roles it
  requires; the API answers `403` when one is missing
- Invitations by e-mail: whoever invites can only grant permissions they already hold

**Security and operation**

- Rate limiting per IP on every sensitive route (Redis), plus a lock after 5 wrong passwords
- Transactional outbox in MongoDB: reset and verification e-mails leave after the commit, run by
  a BullMQ worker with retry and backoff
- Scheduled jobs on BullMQ, declared by each module with a cron pattern and a time zone, run once
  per occurrence however many API instances there are
- Events between modules on RabbitMQ, fed by the same outbox: identity publishes
  `identity.account.registered`; a module subscribes by declaring a `MessageConsumer`, runs each
  event once (inbox) and gives up after 5 attempts into a dead-letter queue
- Errors as RFC 9457 problem details with a stable `code`
- Structured logs with Pino, one event per request, with its request id
- Unexpected errors reported to Sentry (or a local Bugsink), without personal data
- Health check on `GET /health`, graceful shutdown, Docker image built from an esbuild bundle
- 100% test coverage at the unit, integration and e2e levels, plus every route × status pair

## Stack

| Concern         | Choice                                                         |
| --------------- | -------------------------------------------------------------- |
| Runtime         | Node.js 24, TypeScript, ESM, pnpm                              |
| HTTP            | Express 5, Helmet, CORS                                        |
| Validation      | TypeBox                                                        |
| Database        | MongoDB 8 (replica set, for transactions) through Mongoose     |
| Cache and limit | Redis through ioredis                                          |
| Jobs            | BullMQ on the same Redis (outbox effects and scheduled jobs)   |
| Events          | RabbitMQ 4 through `amqp-connection-manager`                   |
| Tokens          | `jose` (HS256) and opaque refresh tokens                       |
| E-mail          | MailerSend, or a logging mailer for development                |
| Errors          | Sentry (`@sentry/node`); Bugsink locally                       |
| Tests           | Vitest, Supertest, in-memory MongoDB and Redis, Testcontainers |
| Front end       | Preact and Vite (`web/`)                                       |
| Quality         | ESLint (with module boundaries), Prettier, husky, commitlint   |

## Getting started

Requirements: Node.js 24, pnpm (the version in `package.json` is downloaded on demand) and
Docker.

```bash
pnpm install
cp .env.example .env            # then set JWT_SECRET: openssl rand -base64 48
cp web/.env.example web/.env
pnpm docker:up                  # MongoDB (replica set), Redis, RabbitMQ and Bugsink
pnpm dev                        # API on http://localhost:3000
pnpm --filter web dev           # front end on http://localhost:5173
```

With `MAILER="log"` (the default) no e-mail is sent: the link is printed in the API log
(`notifications.email_logged`). OAuth
sign-in needs the provider apps described below; everything else works with the example values.

The front end proxies `/api` to the API. Besides the account pages, it has an API explorer at
`/explorer` that lists every route and lets you call it with the signed-in session.

### Making it yours

The name lives in the environment, so most of a rename is three variables:

| Where      | Variable         | Used for                                                                             |
| ---------- | ---------------- | ------------------------------------------------------------------------------------ |
| `.env`     | `APP_NAME`       | lowercase slug: Mongo `appName`, log `service`, OAuth `user-agent`, error `type`     |
| `.env`     | `MAIL_FROM_NAME` | display name in the e-mail sender and in the invitation text                         |
| `web/.env` | `VITE_APP_NAME`  | page title, sidebar brand, prefix of what the front end keeps in the browser storage |

What cannot read the environment: `name` in `package.json`, the two `--filter` flags in the
`Dockerfile`, and the database name in `MONGO_URL` (`.env.example` and the `api` service in
`docker-compose.yml`).

Pick `APP_NAME` once: it is part of every error `type` (`tag:<APP_NAME>,2026:<code>`), which
clients may store or compare.

### The first administrator

Every new account gets the `user` role and no permissions, and there is no bootstrap route.
Sign up, then, with the environment of the API you are targeting:

```bash
pnpm identity:grant-admin you@example.com
```

It gives that account the `admin` role and every permission, and clears its cached membership, so
the next request already sees them. It exits with `1` and logs `identity.admin_grant_failed` when
the e-mail has no active account. From then on, invite the next people with the permissions they
need.

## Configuration

Every variable is validated on boot; the API refuses to start and names each invalid one.
`.env.example` documents them all. The main groups:

| Variables                                                           | Notes                                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `APP_NAME`, `NODE_ENV`, `PORT`, `TRUST_PROXY`, `LOG_LEVEL`          | `TRUST_PROXY` is the number of proxies in front of the API, used for the IP |
| `MONGO_URL`                                                         | must point to a replica set (`?replicaSet=rs0` locally)                     |
| `REDIS_URL`                                                         | rate limit counters and the repository cache                                |
| `RABBITMQ_URL`                                                      | `amqp://` or `amqps://`; required, the events between modules go through it |
| `JWT_SECRET`                                                        | at least 32 characters                                                      |
| `APP_URL`, `CORS_ORIGINS`                                           | e-mail links point to `APP_URL`; `CORS_ORIGINS` is comma-separated          |
| `MAILER`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `MAILERSEND_API_KEY` | `MAILER` is `log` or `mailersend`                                           |
| `GITHUB_*`, `GOOGLE_*`                                              | client id, secret and redirect URI of each OAuth app                        |
| `SENTRY_DSN`                                                        | optional; unset turns error reporting off                                   |
| `DOCS_USERNAME`, `DOCS_PASSWORD`                                    | optional pair; set both to serve the API docs behind HTTP Basic             |

### OAuth apps

The front end owns the redirect, the `state` and the PKCE pair; the API only exchanges the code.
Register the front end callback as the redirect URI, and use the same value in `.env`:

- **GitHub**: [Developer settings → OAuth Apps](https://github.com/settings/developers). Callback
  `http://localhost:5173/auth/github/callback`.
- **Google**: [Google Auth Platform → Clients](https://console.cloud.google.com/auth/clients),
  type "Web application". Authorized redirect URI `http://localhost:5173/auth/google/callback`.
  While the app is in testing, only the test users you add can sign in.

Put the client ids in `web/.env` too (`VITE_GITHUB_CLIENT_ID`, `VITE_GOOGLE_CLIENT_ID`).

### E-mail

`MAILER="log"` prints each e-mail and its link. For real delivery, set `MAILER="mailersend"`,
create an [API token](https://app.mailersend.com/api-tokens) and use a `MAIL_FROM_EMAIL` on a
domain verified in MailerSend. Reset, verification, welcome and e-mail changed e-mails go through
the outbox, so a MailerSend outage delays them instead of failing the request. The e-mail copy is
in Portuguese, in
[identity-email-composer.ts](src/modules/identity/infrastructure/identity-email-composer.ts) and
[notifications-email-composer.ts](src/modules/notifications/infrastructure/notifications-email-composer.ts).
Each e-mail goes out with a plain-text part and an HTML part in the front end's style (lilac
ground, white card, the mark, the violet button), rendered by
[email-html-renderer.ts](src/modules/notifications/infrastructure/email-html-renderer.ts).

### Error tracking

`pnpm docker:up` also starts Bugsink, a Sentry-compatible server, on http://localhost:8000
(`admin` / `admin`). Create a project there and set its DSN as `SENTRY_DSN`.

## API

Every route is under `/api`. Authenticated routes take `Authorization: Bearer <accessToken>`.
With `DOCS_USERNAME` and `DOCS_PASSWORD` set, `/docs` serves Swagger UI and `/openapi.json` the
OpenAPI 3.1 document generated from the routes, both behind HTTP Basic with those credentials;
without them, neither route exists.
"Own or `x`" means the route works on your own account without a permission, and on someone
else's with `x`.

| Method   | Path                              | Access                      | What it does                                         |
| -------- | --------------------------------- | --------------------------- | ---------------------------------------------------- |
| `POST`   | `/auth/sign-up`                   | public                      | creates an account and signs in                      |
| `POST`   | `/auth/sign-in`                   | public                      | signs in with e-mail and password                    |
| `POST`   | `/auth/oauth/:provider`           | public                      | signs in (or up) with a Google or GitHub code        |
| `POST`   | `/auth/refresh`                   | public                      | rotates the refresh token, issues a new access token |
| `POST`   | `/auth/password-reset/request`    | public                      | e-mails a reset link                                 |
| `POST`   | `/auth/password-reset`            | public                      | sets a new password from the reset token             |
| `POST`   | `/auth/email-verification`        | public                      | verifies the e-mail from the token                   |
| `POST`   | `/auth/invitations/accept`        | public                      | creates the invited account                          |
| `POST`   | `/auth/email-change`              | public                      | confirms an e-mail change from the token             |
| `POST`   | `/auth/sign-out`                  | signed in                   | ends the current session                             |
| `GET`    | `/me`                             | signed in                   | account and membership                               |
| `PATCH`  | `/me`                             | signed in                   | updates the name                                     |
| `PUT`    | `/me/password`                    | signed in                   | changes the password                                 |
| `POST`   | `/me/email`                       | signed in                   | starts an e-mail change                              |
| `POST`   | `/me/email-verification`          | signed in                   | sends a new verification link                        |
| `GET`    | `/me/sessions`                    | signed in                   | lists your sessions                                  |
| `DELETE` | `/me/sessions`                    | signed in                   | ends every session but the current one               |
| `GET`    | `/me/credentials`                 | signed in                   | lists the password and linked providers              |
| `POST`   | `/me/oauth/:provider`             | signed in                   | links a provider                                     |
| `DELETE` | `/me/oauth/:provider`             | signed in                   | unlinks a provider                                   |
| `DELETE` | `/sessions/:sessionId`            | own or `session.revoke`     | ends one session                                     |
| `GET`    | `/accounts/:accountId/sessions`   | own or `session.read`       | lists an account's sessions                          |
| `DELETE` | `/accounts/:accountId/sessions`   | own or `session.revoke_all` | ends every session of an account                     |
| `POST`   | `/accounts/:accountId/deactivate` | own or `account.deactivate` | deactivates an account                               |
| `POST`   | `/accounts/:accountId/reactivate` | `account.reactivate`        | reactivates an account                               |
| `GET`    | `/members`                        | `member.read`               | lists members                                        |
| `PUT`    | `/members/:accountId/role`        | `member.role.update`        | changes a member's role label                        |
| `PUT`    | `/members/:accountId/permissions` | `member.permissions.update` | changes a member's permissions                       |
| `POST`   | `/invitations`                    | `invitation.create`         | invites someone by e-mail                            |
| `GET`    | `/invitations`                    | `invitation.read`           | lists invitations                                    |
| `DELETE` | `/invitations/:invitationId`      | `invitation.revoke`         | revokes a pending invitation                         |

Errors are problem details (`application/problem+json`):

```json
{
  "type": "tag:identity-starter,2026:shared.input_invalid",
  "title": "Input invalid",
  "status": 400,
  "code": "shared.input_invalid",
  "data": { "violations": [{ "field": "password", "reason": "minLength" }] }
}
```

Match on `code`. What a client has to do (OAuth `state` and PKCE, password limits, rate limits
per route, `retryAfterSeconds`) is in the [front end contract](docs/auth-front-end-contract.md).

## Project structure

```text
src/
  main.ts                 reads the environment and starts the app
  app/                    composition root: config, server, routes, start and shutdown
  modules/
    identity/
      domain/             entities, value objects and errors, no libraries
      application/        use cases, ports, policies and services, no libraries
      infrastructure/     Mongo repositories, argon2, jose, OAuth, e-mail texts
      presentation/       handlers, routes and the authenticate middleware
      identity.module.ts  wires the module
      public.ts           the only file other modules may import
    notifications/        e-mails sent in reaction to identity events, and the
                          MailerSend adapter every module sends through
  shared/                 building blocks every module uses (errors, HTTP edge, Mongo,
                          Redis, outbox, RabbitMQ, logging, rate limit, test helpers)
web/                      Preact front end
docs/adr/                 architecture decision records
```

Each entry point is a transport-neutral handler bound to HTTP by a small route declaration, so
the same use case can later be exposed to a queue consumer or an MCP tool
([ADR-001](docs/adr/001-transport-neutral-handler-layer.md)). ESLint enforces the boundaries:
`domain` and `application` import no package, other modules import only
`@/<module>/public`, and `shared` never imports a module.

A new module goes in `src/modules/<name>/` with the same layers, a `<name>.module.ts` that wires
it and a line in [src/app/http-routes.ts](src/app/http-routes.ts) for its routes.

## Scripts

| Script                                     | What it does                                           |
| ------------------------------------------ | ------------------------------------------------------ |
| `pnpm dev` / `pnpm start`                  | runs the API from source, with or without watch        |
| `pnpm build`                               | bundles the API to `dist/main.js` with esbuild         |
| `pnpm docker:up`                           | starts MongoDB, Redis, RabbitMQ and Bugsink            |
| `pnpm identity:grant-admin <email>`        | gives an account the `admin` role and every permission |
| `pnpm lint` / `pnpm typecheck`             | ESLint and `tsc --noEmit`                              |
| `pnpm format` / `pnpm format:check`        | Prettier                                               |
| `pnpm test`                                | Vitest in watch mode                                   |
| `pnpm test:unit` / `:integration` / `:e2e` | one test level                                         |
| `pnpm test:coverage`                       | every test, with coverage                              |

To run the API in a container next to MongoDB, Redis and RabbitMQ:
`docker compose --profile app up -d --wait`
([ADR-009](docs/adr/009-run-the-api-from-an-esbuild-bundle-in-a-slim-image.md)).

## Testing

Tests sit next to the code: `*.spec.ts` (unit), `*.integration.spec.ts` and `*.e2e.spec.ts`.
Integration and e2e tests start MongoDB and Redis in memory and RabbitMQ in a container
(Testcontainers), so Docker must be running for them, and for the `pre-commit` hook. Each level
has its own 100% coverage threshold, and the e2e run also fails when a declared route × status
pair is never exercised.

The `pre-commit` hook runs lint-staged, the typecheck and every coverage level; `commit-msg`
checks Conventional Commits. The GitHub Actions workflow (`.github/workflows/ci.yml`) runs the
format check, lint, typecheck and unit coverage; it only starts by hand (`workflow_dispatch`), so
add `push` or `pull_request` to its `on` to run it on every change.

## Decisions

The [ADRs](docs/adr/) record why the code looks the way it does: the transport-neutral handler
layer, optimistic concurrency on every write, TypeBox schemas on handlers, the access every use
case declares, retrying idempotent outbound calls, Sentry reporting, the Docker image, the
Mongo outbox and its BullMQ and RabbitMQ delivery, and the `notifications` module.
