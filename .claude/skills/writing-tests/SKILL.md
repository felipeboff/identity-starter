---
name: writing-tests
description: How tests are written in this repository - faker-first test data with the fewest loose string literals, deterministic branches under random data, spec layout, the shared test helpers (identity context, seeders, expectAppError, the HTTP test client) and 100% coverage. Use when writing, editing or reviewing any `*.spec.ts`, adding test helpers or fakes, or when the user asks to "write the test", "add tests", "check the tests", "use faker". Do NOT use for choosing what to test in a feature plan (use spec-lean) or for production code style.
license: MIT
metadata:
  author: resolve-hub
  version: "1.0.0"
---

# Writing tests

Vitest, specs next to the code, 100% coverage enforced by `vitest.config.ts` and the pre-commit
hook. Follow these rules in every new or edited spec.

## Test levels

The file name says the level; each level is a Vitest project.

| Level       | File                    | What it touches                                                          | Run                     |
| ----------- | ----------------------- | ------------------------------------------------------------------------ | ----------------------- |
| unit        | `*.spec.ts`             | no I/O: entities, value objects, use cases on in-memory fakes            | `pnpm test:unit`        |
| integration | `*.integration.spec.ts` | an adapter against the real dependency: Mongo, a real HTTP server        | `pnpm test:integration` |
| e2e         | `*.e2e.spec.ts`         | real HTTP through Express (`supertest`, `createIdentityHttp()`, `start`) | `pnpm test:e2e`         |

- ESLint fails a unit spec that imports `supertest`, `express`, `mongodb-memory-server`,
  `node:http`, `node:net`, `memory-mongo` or a `testing/*-http` harness.
- The level follows the folder: a spec of a file in `infrastructure/` (or a `*.module.ts`) is an
  integration spec, a spec of an HTTP route is an e2e spec, everything else is unit.
- Each level must reach 100% of its own scope, measured alone (`testing/` folders excluded):

  | Command                          | Scope                                                                                                         |
  | -------------------------------- | ------------------------------------------------------------------------------------------------------------- |
  | `pnpm test:unit:coverage`        | `domain/`, `application/`, `shared/presentation/`, `shared/types/`, `public.ts`, `app/config`, `app/shutdown` |
  | `pnpm test:integration:coverage` | `infrastructure/` and `*.module.ts`                                                                           |
  | `pnpm test:e2e:coverage`         | every module's `presentation/`, `app/create-server`, `app/http-routes`, `app/start`                           |

- `pnpm test:e2e:coverage` also checks every route × status pair. Each `HttpRoute` lists its
  `failures` (400, 401, 403, 404, 409, 422). The run fails on a declared status no e2e test
  received (`missing e2e test`) and on a received status the route does not declare
  (`undeclared status`). A new route or a new error path needs both the `failures` entry and
  an e2e test.
- `pnpm test:coverage` runs every level together and needs 100% of `src/`, `testing/` included.
- The scopes live in `vitest.config.ts` (`LEVEL_SCOPES`); a new top-level folder needs a level.

## Test data: faker first, almost no loose strings

Every value whose exact content does not matter comes from `@faker-js/faker`, bound to a
well-named const and asserted against that const:

```ts
const name = faker.person.fullName();
const out = await http.call("PATCH", "/me", { token, body: { name } });
expect(out.body).toMatchObject({ account: { name } });
```

A literal is allowed **only when the exact value is the behavior under test**:

- validator input → output tables (`" TRUE "` → `true`, `"1e3"` → `1000`), regex tables, known
  valid/invalid CPF/CNPJ numbers and their formatted forms
- `""` and `"   "` when the rule is about empty or blank input
- public contract values: HTTP method and path, `tag:resolve-hub,2026:` prefix, a problem
  `title` derived from its code, `content-type` headers, status codes
- enum values, `ErrorKind` values, violation `reason` codes, field names in violations,
  environment variable names
- the fixed output format of a fake (`$fake$<password>`, `hash:<token>`) in that fake's own spec
- `describe`/`it` titles and `it.each` case labels (titles, not data)

Prefer the source of truth over a copied string:

| Instead of                         | Use                                                                  |
| ---------------------------------- | -------------------------------------------------------------------- |
| `"identity.invalid_access_token"`  | `IdentityError.InvalidAccessToken.code`                              |
| `"shared.input_invalid"`           | `SharedError.InputInvalid.code`                                      |
| `"google"`                         | `AuthProvider.GOOGLE`                                                |
| `"admin"`                          | `MembershipRole.ADMIN`                                               |
| `defineError("test.failed", kind)` | ``defineError(`${faker.lorem.word()}.${faker.lorem.word()}`, kind)`` |

### Invalid values, still from faker

| Need                                 | Use                                                             |
| ------------------------------------ | --------------------------------------------------------------- |
| unknown enum value (role, reason...) | `faker.string.alpha(12) as MembershipRole`                      |
| invalid ObjectId                     | `faker.string.alpha(5)`                                         |
| not an e-mail                        | `faker.lorem.word()`                                            |
| a different id than `x`              | `faker.database.mongodbObjectId()`                              |
| non-integer number as string         | `` `${faker.number.int({ min: 1, max: 100 })}.5` ``             |
| number out of a range                | `faker.number.int({ min: max + 1, max: max * 10 })`             |
| string shorter than `n`              | `faker.string.alphanumeric({ length: { min: 1, max: n - 1 } })` |
| unknown key in an object             | `faker.string.alpha({ length: 12, casing: "upper" })`           |

### Random data must never pick the branch

Coverage must be 100% on every run. Before using a faker value, check it cannot land on another
branch: a word that could be a valid enum value, a number that could be `0` or in range, a
string that could be empty or contain spaces. Constrain it (`length`, `min`/`max`) or keep the
literal. Example: `faker.internet.port()` can return `0`; use
`faker.number.int({ min: 1, max: 65_535 })` when `0` is invalid. After touching random data,
run the spec three times.

## Structure

- Each `it` reads on its own: arrange, act, assert, separated by a blank line.
- `beforeEach` only creates the context and the unit under test; scenario data lives in the
  `it`.
- One small local factory with overrides per spec (`buildSource(overrides)`,
  `buildInbound(...)`); no shared fixtures across files beyond the helpers below.
- `it.each` for cases that differ only in data.
- Whole-object assertions (`toStrictEqual`) when the shape is the contract; `toMatchObject`
  only to ignore fields that are not the point of the test.
- Validator results are asserted as `{ ok: true, data }` / `{ ok: false, violations }`.
- Comments only for non-obvious information.

## Helpers

| Helper                                                                           | For                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `createIdentityContext()`                                                        | every identity dependency as in-memory fakes; pass it as `deps`                                                                                                                                                                                                                                                                |
| `seedAccount(ctx, options?)`, `seedSession(ctx, seeded)`                         | persisted account, credential, membership and session                                                                                                                                                                                                                                                                          |
| `expectAppError(promise, Definition, data?)`                                     | asserting a rejected `AppError` by definition                                                                                                                                                                                                                                                                                  |
| `new FakeLogger()` (`@shared/testing/fake-logger`)                               | any `Logger` dependency; assert on `logger.entries` (`{ level, event: Event.name, fields }`)                                                                                                                                                                                                                                   |
| `new FakeLogContext()` (`@shared/testing/fake-log-context`)                      | any `LogContext` dependency; assert on `logContext.added`                                                                                                                                                                                                                                                                      |
| `useMemoryMongo()` (`@shared/testing/memory-mongo`)                              | integration and e2e specs against a real Mongo: a database of its own inside the run's single replica set (started once by `memory-databases.global-setup.ts`), dropped after the file; call `.connection()` inside the tests or a `beforeAll`; `memoryMongoUri(name)` gives a URI to a named database in the same replica set |
| `useMemoryRedis()` (`@shared/testing/memory-redis`)                              | specs against a real Redis: a logical database of its own (picked by the worker's `VITEST_POOL_ID`) in the run's single Redis, emptied before the file and after each test                                                                                                                                                     |
| `<port>RepositoryContract(create)` (`identity/application/testing/contracts/`)   | one suite per repository port, run against the in-memory and the Mongo implementation; a new repository behaviour goes in the contract, not in one implementation's spec                                                                                                                                                       |
| `createIdentityHttp()` (`presentation/testing/identity-http`)                    | e2e route specs over real HTTP: `call(method, path, { params, body, token, ip })`, `signIn()`; records every route × status it answers                                                                                                                                                                                         |
| `vi.spyOn(UseCase.prototype, "execute")` + `vi.restoreAllMocks()` in `afterEach` | asserting a use case was not called when the module hides instances                                                                                                                                                                                                                                                            |

## Special cases

- **A spec that acts on the whole database server** (`CLIENT PAUSE`, `CLIENT KILL`, stopping or
  restarting it, a standalone `mongod`): start a server of its own in that spec, as
  `redis-connection` and `mongo-database` do, so the shared instances stay untouched.

- **Module that reads `process.env` at import** (`src/app/config.ts`): stub first, then import
  dynamically, so the import sees valid values:

  ```ts
  const processEnv = buildSource();
  for (const [name, value] of Object.entries(processEnv))
    vi.stubEnv(name, value);
  const { env, loadEnv } = await import("./config");
  ```

- **Simulating an unexpected failure**: specs and `testing/` folders may throw or reject with a
  plain `Error`; ESLint forbids it only in production code.
- **Classes under test that need a concrete subclass** (`Handler`, `Middleware`): declare a
  minimal one in the spec; return `Promise.resolve(...)` instead of an `async` method without
  `await` (lint rule `require-await`).

## Before finishing

`pnpm exec prettier --write <files>`, `pnpm exec eslint .`, `pnpm typecheck`,
`pnpm test:coverage`, `pnpm test:unit:coverage`, `pnpm test:integration:coverage` and
`pnpm test:e2e:coverage` (100% statements, branches, functions and lines in each).
