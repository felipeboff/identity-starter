# TypeBox handler checks

Profile: light
Plan: `.specs/features/typebox-handler/plan.md`

22 checks in 3 slices · 8 one-way doors · 0 open, of which 0 block

`P` stands for `src/shared/presentation`, `ID` for `src/modules/identity/presentation`.

## Checks

### S1 - The handler declares name and input, and the dispatcher interprets · 40 files · 120 KB · ~30k · done

**C1** - A handler with `input: Type.Object({ age: Type.Integer() })` receives `{ age: 42 }` when the dispatcher gets `{ age: "42", extra: 1 }` (AC 1)
Proof: `pnpm exec vitest run P/dispatcher.spec.ts -t "hands the handler the input converted by its schema"`

**C2** - A handler whose schema declares `default` for a missing field receives that default (AC 2)
Proof: `pnpm exec vitest run P/dispatcher.spec.ts -t "fills the defaults the schema declares"`

**C3** - A handler whose schema has a `Type.Codec(Type.String({ format: "url" }))` decoding into `URL` receives a `URL` instance with the sent `href` (AC 3)
Proof: `pnpm exec vitest run P/dispatcher.spec.ts -t "decodes the codecs the schema declares"`

**C4** - An input the schema refuses makes the dispatcher throw an `AppError` with code `shared.input_invalid` and `data.violations`, and the handler is never called (AC 4)
Proof: `pnpm exec vitest run P/dispatcher.spec.ts -t "refuses an input the schema does not accept without calling the handler"`

**C5** - A middleware that throws wins over an invalid input: the dispatcher rethrows the middleware's error, and `PATCH /me` with no token and body `{}` answers `401` (AC 5)
Proof: `pnpm exec vitest run P/dispatcher.spec.ts -t "propagates a middleware error before reading the input"`
Proof: `pnpm exec vitest run ID/identity.routes.e2e.spec.ts -t "answers 401 before reading the input"`

**C6** - A handler with no `input` receives `{}` in `inbound.input`, whatever was sent (AC 6)
Proof: `pnpm exec vitest run P/dispatcher.spec.ts -t "hands an empty object to a handler with no input"`

**C7** - Every one of the 28 mounted identity handlers has a `name` matching `/^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/`, and no two share one (AC 7)
Proof: `pnpm exec vitest run ID/identity.routes.e2e.spec.ts -t "names every handler as module.operation, once"`

**C8** - Every one of the 28 mounted identity handlers exposes an input schema (its `input` or the empty object) whose JSON equals its JSON round trip and has `type: "object"` (AC 8)
Proof: `pnpm exec vitest run ID/identity.routes.e2e.spec.ts -t "describes every input as a JSON object schema"`

**C9** - While a route runs, the log context holds `operation` equal to the route handler's `name`, next to `requestId`, `method` and `route` (AC 9)
Proof: `pnpm exec vitest run src/shared/infrastructure/http/express-adapter.integration.spec.ts -t "runs the handler with the request id, method, route template and operation"`

### S2 - Violations in the JSON Schema vocabulary · 3 files · 10 KB · ~3k · done

`SP` stands for `src/shared/presentation/schema-parser.spec.ts`.

**C10** - A 5-character `password` against `minLength: 12` gives exactly `{ field: "password", reason: "minLength" }`; an invalid e-mail gives `reason: "format"` and an unknown enum value `reason: "enum"` (AC 10)
Proof: `pnpm exec vitest run SP -t "names the keyword that failed"`

**C11** - Missing `name` and `email` in a schema declaring `name, email, password` give `[{ field: "name", reason: "required" }, { field: "email", reason: "required" }]` in that order, and a missing nested property gives its full path (AC 11)
Proof: `pnpm exec vitest run SP -t "reports each missing property as required"`

**C12** - A failure inside `items[1].name` has `field: "items.1.name"`, and a failure of the whole value (a string where an object is expected) has `field: ""` (AC 12)
Proof: `pnpm exec vitest run SP -t "writes the field as a dotted path"`
Proof: `pnpm exec vitest run SP -t "uses an empty field at the root"`

**C13** - A value failing two branches of a union with the same keyword yields that `field`/`reason` pair once (AC 13)
Proof: `pnpm exec vitest run SP -t "reports each field and reason once"`

**C14** - `safeParse` returns `{ ok: true, data }` for a valid input and `{ ok: false, violations }` for an invalid one without throwing; `parse` throws `shared.input_invalid` with those violations, and when it receives its own error definition it throws that definition with the same violations (AC 14, names per Landing door 8)
Proof: `pnpm exec vitest run SP -t "returns the data of a valid input"`
Proof: `pnpm exec vitest run SP -t "returns the violations of an invalid input without throwing"`
Proof: `pnpm exec vitest run SP -t "throws shared.input_invalid with the violations"`
Proof: `pnpm exec vitest run SP -t "throws the error definition it receives"`

### S3 - Every caller runs on TypeBox · 35 files · 90 KB · ~23k · done

**C15** - 21 of the 22 input-reading identity routes answer `400 shared.input_invalid` with `data.violations` naming a field before their use case runs, table-driven; `DELETE /me/oauth/:provider` cannot be refused by its schema, because its only input is a path segment the router always fills with a string. The identity e2e specs pass, and no pre-existing e2e assertion on `violations` changes (none asserted a `reason`) (AC 15)
Proof: `pnpm exec vitest run ID/identity.routes.e2e.spec.ts -t "answers 400 before the use case on"`
Proof: `pnpm exec vitest run --project e2e src/modules/identity/presentation`

**C16** - `loadEnv` refuses each case of `config.spec.ts` on the same `field` as today, names the 10 missing required variables at once, reads a valid environment with numbers and URLs parsed, and fills the defaults (AC 16)
Proof: `pnpm exec vitest run src/app/config.spec.ts -t "refuses|names every missing required variable at once|reads a valid environment|defaults the optional variables"`

**C17** - `FetchOAuthGateway` fails with `unexpected_body` on a Google user missing `sub` and on a GitHub token body carrying `error` (AC 17)
Proof: `pnpm exec vitest run src/modules/identity/infrastructure/fetch-oauth-gateway.integration.spec.ts -t "fails when the user comes back in an unexpected shape|fails and logs GitHub's error when the token request is refused for another reason"`

**C18** - `src/shared/application/validator` does not exist and no file in `src` names that path (AC 18)
Proof: `test ! -e src/shared/application/validator && ! grep -rln "application/validator" src`

**C19** - `package.json` depends on `"typebox": "^1.3.37"` and the lockfile resolves `typebox@1.3.37` (Landing door 1)
Proof: `grep -q '"typebox": "\^1.3.37"' package.json && grep -q '^  typebox@1.3.37:' pnpm-lock.yaml`

**C20** - Every file in `src/shared/presentation` imports only `src/shared` or `typebox` (Landing door 6)
Proof: `pnpm exec vitest run P/boundary.spec.ts -t "imports nothing outside src/shared and typebox"`

**C21** - A domain or application file importing `typebox` or `node:crypto` fails `eslint` with the message `Domain and application import no library`, and the whole repo lints clean (Landing door 7)
Proof: `printf 'import Type from "typebox";\nexport const probe = Type;\n' > src/shared/application/zz-probe.ts; pnpm exec eslint src/shared/application/zz-probe.ts | grep -q "Domain and application import no library"; s=$?; rm src/shared/application/zz-probe.ts; exit $s`
Proof: `printf 'import { randomUUID } from "node:crypto";\nexport const probe = randomUUID;\n' > src/modules/identity/domain/zz-probe.ts; pnpm exec eslint src/modules/identity/domain/zz-probe.ts | grep -q "Domain and application import no library"; s=$?; rm src/modules/identity/domain/zz-probe.ts; exit $s`
Proof: `pnpm exec eslint .`

**C22** - At the HTTP edge, a refused input answers exactly `400` with problem details whose `data.violations` are `{ field, reason }` with the JSON Schema keyword: a short sign-up password gives `password`/`minLength`, an empty sign-in gives `email`/`required` then `password`/`required`, a malformed reset e-mail gives `email`/`format`, an unknown role gives `role`/`enum`, and a malformed session id gives `sessionId`/`pattern` (AC 10, AC 11, at the Surface row's boundary)
Proof: `pnpm exec vitest run ID/identity.routes.e2e.spec.ts -t "answers 400 with each field and the JSON Schema keyword that failed"`

## Coverage

| Set (size)                                  | Member -> proof                                                                                                                                                                                               | Unproven |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| interpretation steps (5)                    | convert C1 · clean C1 · default C2 · decode C3 · refuse C4                                                                                                                                                    | -        |
| dispatcher order (2)                        | middleware before input C5 · no input gives `{}` C6                                                                                                                                                           | -        |
| mounted handlers (28)                       | name C7, table-driven over all 28 · input schema C8, table-driven over all 28                                                                                                                                 | -        |
| violation rules (5)                         | keyword as reason C10 · one `required` per property C11 · dotted field C12 · root field C12 · no repeated pair C13                                                                                            | -        |
| `SchemaParser` outcomes (4)                 | safeParse ok C14 · safeParse refused C14 · parse default error C14 · parse given error C14                                                                                                                    | -        |
| callers moved to TypeBox (3)                | identity handlers C15 · `config.ts` C16 · `FetchOAuthGateway` C17                                                                                                                                             | -        |
| identity routes reading input: statuses (1) | `400` C15 (`answers 400 before the use case on %s %s`, 21 routes; `DELETE /me/oauth/:provider` n/a - its only input is a path segment the router always fills) · body shape at the edge C22                   | -        |
| `Landing` doors (8)                         | 1 dependency C19 · 2 handler contract C1 · C6 · 3 operation name C7 · 4 violation C10 · C11 · C12 · C13 · 5 interpretation C14 · 6 boundary C20 · 7 no library in domain/application C21 · 8 method names C14 | -        |

- The `Surface` route row's only status, `400`, is proven at the edge by C15 and its body at the edge by C22; C10-C13 prove the rules at the parser's own layer
- No other check claims more than the cases its proof exercises

## Swept

- validation: C1-C4, C10-C14, C16
- failure modes: C4, C17
- idempotency: n/a - interpreting an input writes nothing
- authorization: existing - `AuthenticateMiddleware` keeps running before the input is read (C5)
- concurrency: n/a - `SchemaParser` and the schemas hold no mutable state
- data lifecycle: n/a - nothing is stored
- dependency failure: C17
- state transitions: n/a - no state machine is touched
- observability: C9

## Handoff

- S1 = 30k, S2 enters at 33k, S3 at 56k total (about 220 KB of handlers, dispatcher, adapter, config, gateway and their specs / 4), under the 150k budget - one builder
- **Boundary:** C1-C22 closed (uncommitted, awaiting the user's review)
- **Settled mid-build:** `SchemaParser` moved from `src/shared/application` to `src/shared/presentation` (user: application knows no library); the shared ObjectId TypeBox schema replaced by the `OBJECT_ID_PATTERN` string exported by `Id`, which the handlers import (user); `Env` in `config.ts` derived with `Type.StaticDecode<typeof envSchema>` instead of written by hand (user); `SchemaParser` methods renamed to `safeParse` (result) and `parse` (throws) by the user (Landing door 8), and door 7 with C21 added at the user's request; the gateway checks provider bodies with TypeBox's `Value` directly; the handler count in the plan corrected from 25 to 22; `Convert` truncating integers recorded in `Impact`
- **Abandoned:** `Type.Decode(type, callback)` for the URL codecs - `Value.Decode` returned the raw string in 1.3.37; `Type.Codec(...).Decode(...).Encode(...)` used instead
