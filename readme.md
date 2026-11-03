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

- E-mail verification, password reset and password change
- E-mail change, confirmed from the new address, with a notice to the old one
- Welcome e-mail on every account created
- Profile name update; account deactivation and reactivation

**Sessions**

- Many sessions per account, each with IP and user agent
- List your sessions, sign out of one, or of all the others
- Revocation ends the session for good, with a reason (`logout`, `security`, `email_changed`, ...)

**Access control**

- Each account has a membership with a role label and a list of permissions
- Every use case declares its access (anyone, any member, or the permissions it requires)
- Invitations by e-mail: whoever invites can only grant permissions they already hold
- Each module declares its own permission codes; the app joins them in one catalog, checked at boot

**Operation**

- Rate limiting per IP on sensitive routes, plus a lock after 5 wrong passwords
- Transactional outbox: e-mails leave after the commit and are retried by BullMQ
- Events between modules on RabbitMQ, and scheduled jobs on BullMQ, declared by each module
- RFC 9457 problem details with a stable `code`; OpenAPI 3.1 generated from the routes
- Pino logs with a request id; unexpected errors reported to Sentry, without personal data
- Health check, graceful shutdown, Docker image built from an esbuild bundle
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
(`notifications.email_logged`). OAuth sign-in needs the provider apps described below; everything
else works with the example values.

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
`docker-compose.yml`). Pick `APP_NAME` once: it is part of every error `type`, which clients may
store or compare.

### The first administrator

Every new account gets the `user` role and no permissions, and there is no bootstrap route. Sign
up, then, with the environment of the API you are targeting:

```bash
pnpm identity:grant-admin you@example.com
```

It gives that account the `admin` role and every permission in the catalog. From then on, invite
the next people with the permissions they need.

### Adding a module

A module goes in `src/modules/<name>/` with the same layers as `identity`, a `<name>.module.ts`
that wires it and a line in [src/app/http-routes.ts](src/app/http-routes.ts) for its routes.

It declares its permission codes in its own domain, prefixed with its name, and exports them next
to its `create<Module>Module`:

```ts
export const OrdersPermission = {
  ORDER_CREATE: "orders.order.create",
} as const;

export const ordersPermissions: ModulePermissions = {
  module: "orders",
  permissions: Object.values(OrdersPermission),
};
```

Add `ordersPermissions` to [src/app/permission-catalog.ts](src/app/permission-catalog.ts); a
repeated or unprefixed code stops the boot. Its use cases require the codes in `access`
(`{ permissions: [OrdersPermission.ORDER_CREATE] }`), and running `pnpm identity:grant-admin`
again gives them to the administrator.

## Configuration

Every variable is validated on boot, and the API refuses to start naming each invalid one.
`.env.example` documents them all. The ones that bite:

- `MONGO_URL` must point to a replica set (`?replicaSet=rs0` locally), because the use cases run
  in transactions.
- `RABBITMQ_URL` is required; the API does not start without RabbitMQ.
- `JWT_SECRET` needs at least 32 characters.
- `TRUST_PROXY` is the number of proxies in front of the API, used to read the client IP.
- `SENTRY_DSN` and the `DOCS_USERNAME` / `DOCS_PASSWORD` pair are optional and off when unset.

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

For real delivery, set `MAILER="mailersend"`, create an
[API token](https://app.mailersend.com/api-tokens) and use a `MAIL_FROM_EMAIL` on a domain
verified in MailerSend. Reset, verification, welcome and e-mail changed e-mails go through the
outbox, so a MailerSend outage delays them instead of failing the request. The copy is in
Portuguese, in
[identity-email-composer.ts](src/modules/identity/infrastructure/identity-email-composer.ts) and
[notifications-email-composer.ts](src/modules/notifications/infrastructure/notifications-email-composer.ts);
the HTML layout is
[email-html-renderer.ts](src/modules/notifications/infrastructure/email-html-renderer.ts).

### Error tracking

`pnpm docker:up` also starts Bugsink, a Sentry-compatible server, on http://localhost:8000
(`admin` / `admin`). Create a project there and set its DSN as `SENTRY_DSN`.

## API

Every route is under `/api`; authenticated routes take `Authorization: Bearer <accessToken>`. To
see them all, use the front end's `/explorer`, or set `DOCS_USERNAME` and `DOCS_PASSWORD` to serve
Swagger UI on `/docs` and the OpenAPI document on `/openapi.json`, behind HTTP Basic.

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

Match on `code`. What a client has to do (OAuth `state` and PKCE, password limits, rate limits,
which permission each route needs) is in the [front end contract](docs/auth-front-end-contract.md).

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
docs/                     architecture decisions, backlog, front end contract
```

Each entry point is a transport-neutral handler bound to HTTP by a small route declaration, so
the same use case can later be exposed to a queue consumer or an MCP tool. ESLint enforces the
boundaries: `domain` and `application` import no package, other modules import only
`@/<module>/public`, and `shared` never imports a module.

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

To run the API in a container next to its services: `docker compose --profile app up -d --wait`.

## Testing

Tests sit next to the code: `*.spec.ts` (unit), `*.integration.spec.ts` and `*.e2e.spec.ts`.
Integration and e2e tests start MongoDB and Redis in memory and RabbitMQ in a container, so Docker
must be running for them and for the `pre-commit` hook. Each level has its own 100% coverage
threshold, and the e2e run also fails when a declared route × status pair is never exercised.

The `pre-commit` hook runs lint-staged, the typecheck and every coverage level; `commit-msg`
checks Conventional Commits. The GitHub Actions workflow runs the format check, lint, typecheck
and unit coverage, started by hand (`workflow_dispatch`).

## Docs

- [docs/architecture.md](docs/architecture.md): why the code looks the way it does, one section
  per decision.
- [docs/backlog.md](docs/backlog.md): known risks, work left out on purpose and what was decided
  against.
- [docs/auth-front-end-contract.md](docs/auth-front-end-contract.md): what a client has to do so
  sign-in stays safe.
