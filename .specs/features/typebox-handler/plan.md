# TypeBox handler

## Problem

The input of each operation exists only as code: a `v` schema inside each handler's `handle`, run
with `probe` on the first line. Nothing outside the handler knows which input it accepts or what it
is called without running it. ADR-001 already plans MCP tools over the same handlers (`McpTool`),
and STACK.md plans OpenAPI; both have to read the shape of each operation's input and a stable name
for it. Today whoever writes the first binding will have to describe each input again, by hand,
next to the schema.

The validator that describes that input is in-house (about 1000 lines in
`src/shared/application/validator`, plus specs), kept in three copies (resolve-hub, `vale`,
linkio). It does not produce JSON Schema, and the survey of 2026-10-30 found five wrong answers that
linkio already fixed in its copy. Every new format, fix or description generator is our own code to
write, test to 100% and port.

No external evidence beyond the code: there is no MCP binding and no client consuming it today.

When this ships: each handler declares `name` and `input` (a TypeBox schema, which already is JSON
Schema); the dispatcher interprets the input after the middlewares and hands the handler the typed
input; a refusal answers `400 shared.input_invalid` with violations in the JSON Schema vocabulary;
and the in-house validator no longer exists in this repository.

## Flow

Reuses the `Dispatcher` + middleware chain, `AppError`/`SharedError.InputInvalid` and the
`HttpErrorMapper` as they are; TypeBox only takes the validator's place, and validation moves from
inside each handler to a single point.

1. the Express adapter (exists) builds the `Inbound` (`{ ...query, ...body, ...params }`, `metadata`, `ip`) and adds `operation: <handler name>` to the log context (door 3)
2. `Dispatcher` in `src/shared/presentation` (exists) runs the route's middlewares (authentication, rate limit) as today
3. at the end of the chain, `SchemaParser` (door 5) interprets the input with the handler's `input` (or the empty object): clones, fills defaults, converts, removes unknown keys, refuses with violations (door 4), decodes codecs
4. the handler (door 2) receives `inbound.input` already typed and calls the use case in `src/modules/identity/application/use-cases` (exists)
5. on a refusal, the `AppError` goes up to the `HttpErrorMapper` (exists) and leaves as `400` problem details
6. outside the chain, `src/app/config.ts` (exists) uses the same `SchemaParser` for the environment, and `FetchOAuthGateway` (exists, infrastructure) checks and decodes the OAuth providers' responses with TypeBox's `Value` directly

## Impact

| Front       | What changes                                                                                                                                                                                                                                                                                                                                                                                  |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| domain      | removed term: `v`, `Schema`, `ParseResult`, `StringOptions` and the rest of `src/shared/application/validator`; who uses it today: 22 identity handlers, `code-verifier.ts`, `config.ts`, `fetch-oauth-gateway.ts`                                                                                                                                                                            |
| domain      | new term: `SchemaParser` - shared role that interprets an input against a TypeBox schema and turns a refusal into violations; lives in `src/shared/presentation`, since application and domain import no library                                                                                                                                                                              |
| domain      | existing term: `Handler` - gains `name` and `input`, and `handle` now receives the already interpreted input; `Inbound` gains the input type as its second parameter. Who extends it: the 28 identity handlers and the dispatcher specs                                                                                                                                                       |
| domain      | existing term: `Dispatcher` - now receives `SchemaParser` in its deps; who builds it: `create-server.ts`, `identity-http.ts`, two integration specs and the dispatcher spec                                                                                                                                                                                                                   |
| contract    | `data.violations[].reason` of `400 shared.input_invalid` changes from the in-house vocabulary (`min_length`, `invalid_email`, `invalid_string`) to the JSON Schema keyword (`minLength`, `format`, `type`). Who reads it: the identity e2e specs, `config.spec.ts`; no published client reads `reason` today (the front-end contract only mentions `field`)                                   |
| behaviour   | the e-mail is no longer trimmed and lower-cased at the edge; the `Email` value object already does that in the domain. An e-mail with surrounding spaces is now refused (`format`)                                                                                                                                                                                                            |
| behaviour   | a number arriving as empty text (`TRUST_PROXY=`) becomes `0` through TypeBox's conversion, instead of being refused                                                                                                                                                                                                                                                                           |
| behaviour   | `config.ts` splits `CORS_ORIGINS` on commas before interpreting, and refuses blank text through `pattern` instead of trimming                                                                                                                                                                                                                                                                 |
| behaviour   | found while building: TypeBox's `Convert` truncates text into a `Type.Integer` (`"12.5"` -> `12`, `Math.trunc`), so a whole-number input that must refuse a fraction is `Type.Number({ multipleOf: 1 })`; `config.ts` does that for `PORT` and `TRUST_PROXY`, and its URLs use one `pattern` each so a bad value gives one violation                                                          |
| domain      | existing term: `Id` - exports `OBJECT_ID_PATTERN` and checks with it; it already lower-cases before checking, so accepting `A-F` changes nothing it stores. Who reads the string: the 7 handlers taking an account, session, invitation or member id                                                                                                                                          |
| boundary    | `src/shared/presentation/boundary.spec.ts` now accepts the `typebox` package besides `src/shared`                                                                                                                                                                                                                                                                                             |
| lint        | `eslint.config.ts` refuses any library import (packages and `node:`) in domain and application files (door 7); the user extended it while building into a layer matrix: domain imports no application, presentation or infrastructure; application imports no presentation or infrastructure; presentation imports no library but `typebox` and no infrastructure. No existing file breaks it |
| docs        | new ADR (TypeBox at the input and input declared on the handler) superseding the ADR-001 lines about `probe` and `v.object`; `STACK.md` "Input validation" points to TypeBox; `docs/validator-url.md` and `docs/validator-process-env.md` go away; `docs/auth-front-end-contract.md` says `reason` is the JSON Schema keyword                                                                 |
| stored data | nothing to migrate                                                                                                                                                                                                                                                                                                                                                                            |

## Relations

None - no stored-data shape change.

## Surface

| Route                                      | In        | Out                                                                                                               | Status |
| ------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------- | ------ |
| every identity route that reads input (22) | unchanged | body of `400 shared.input_invalid`: `data.violations[]` = `{ field, reason }` with `reason` = JSON Schema keyword | `400`  |

## Landing

| One-way door                             | Literal shape                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Alternative rejected                                                                                                                                                                                                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Dependency                            | `"typebox": "^1.3.37"` in `dependencies` (ESM, no dependencies of its own); import `import Type from "typebox"`                                                                                                                                                                                                                                                                                                                                                               | `@sinclair/typebox` 0.34 - the LTS line built for TypeScript 5, and the repo is on 6.0.3, which 1.x is built for; `typebox` 1.4.x - published less than 14 days before 2026-10-30; Valibot - JSON Schema only through conversion, which does not cover `transform` or own checks          |
| 2. Handler contract (precedent)          | `abstract class Handler<S extends { deps?; actor?; input?: TSchema; output? }> { abstract readonly name: string; readonly input?: ResolveInput<S>; abstract handle(inbound: Inbound<ResolveActor<S>, StaticDecode<ResolveInput<S>>>): Promise<ResolveOutput<S>> }`; `type Inbound<TActor = undefined, TInput = unknown> = { input: TInput; metadata; ip; actor: TActor }`; each handler writes `readonly name = "identity.revoke_session"` and `readonly input = inputSchema` | validating inside `handle` (as today) - MCP and OpenAPI cannot read the schema without running the handler, and each handler repeats the `probe`; name and schema on the binding (ADR-001's `McpTool = Entry & { name }`) - HTTP, MCP and queue would describe the same input three times |
| 3. Operation name (future contract)      | `<module>.<operation>` in snake_case, `/^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/`, unique across every mounted route: `identity.sign_in_with_email`                                                                                                                                                                                                                                                                                                                                 | camelCase (`signInWithEmail`) - clashes with the error codes `identity.session_expired`; the class name (`constructor.name`) - renaming the class would silently rename a public tool                                                                                                     |
| 4. Violation (public contract)           | `{ "field": "items.1.name", "reason": "minLength" }`: `reason` is the JSON Schema keyword that failed; `required` becomes one violation per missing property, with its path; `field` dotted, `""` at the root; repeated pairs appear once                                                                                                                                                                                                                                     | in-house snake_case reasons (`min_length`) - the user's choice: same vocabulary as the published `inputSchema`, no translation table; `field` as a JSON pointer (`/items/1/name`) - breaks the dotted format the specs and `config` use today (`CORS_ORIGINS.1`)                          |
| 5. Input interpretation (precedent)      | `SchemaParser.parse(schema, raw)` -> `{ ok: true, data }` \| `{ ok: false, violations }` and `SchemaParser.probe(schema, raw, error?)` which throws; steps `Clone` -> `Default` -> `Convert` -> `Clean` -> `Errors` (refusal) -> `Decode`, from `typebox/value`                                                                                                                                                                                                               | `Value.Parse` with `correctiveParse` - a process-wide setting, and its `ParseError` carries 1 error by default (`maxParseErrors: 1`), losing "every missing variable at once"; TypeBox directly in each caller - three places turning errors into violations                              |
| 6. Boundary of `src/shared/presentation` | `boundary.spec.ts` accepts `src/shared` and the `typebox` package, nothing else                                                                                                                                                                                                                                                                                                                                                                                               | re-exporting TypeBox's types through an alias in `src/shared` - a layer that hides nothing, since handlers import `typebox` directly                                                                                                                                                      |

| 7. Domain and application import no library (precedent, asked by the user while building) | `no-restricted-imports` pattern `{ regex: "^(?!\\.\|@/\|@shared/)" }` on `src/**/domain/**/*.ts` and `src/**/application/**/*.ts`, specs and `testing/` excluded: only relative, `@/` and `@shared/` imports, `import type` and `node:` included | a convention with no rule - `SchemaParser` landed in `src/shared/application` importing `typebox` in this very feature and passed lint and typecheck; allowing `node:` built-ins - the rule is "no library", and no domain or application file imports one today |

| 8. `SchemaParser` method names (changed by the user after approval, supersedes the names in door 5 and AC 14) | `safeParse(schema, raw)` -> `{ ok: true, data }` \| `{ ok: false, violations }`; `parse(schema, raw, error?)` throws `shared.input_invalid` (or the definition passed); the dispatcher and `config.ts` call `parse` | `parse` (result) and `probe` (throws), the in-house validator's names - the user chose the pair TypeScript developers already know from zod: `parse` throws, `safeParse` returns a result |

- Nothing else in this change is hard to reverse

## Criteria

### S1: The handler declares name and input, and the dispatcher interprets (P1)

The handler receives the input already interpreted by the schema it declares.

**Acceptance Criteria**

1. WHEN the dispatcher runs an entry whose handler declares `input` THEN the handler SHALL receive in `inbound.input` the value converted and without unknown keys - `{ "age": "42", "extra": 1 }` against `Type.Object({ age: Type.Integer() })` arrives as `{ age: 42 }`
2. WHERE the schema declares a `default` for a missing field the handler SHALL receive that default
3. WHERE the schema uses a codec the handler SHALL receive the decoded value - a `Type.Codec(Type.String({ format: "url" }))` that decodes into `URL` hands over a `URL` instance
4. IF the input does not satisfy the schema THEN the dispatcher SHALL throw an `AppError` with code `shared.input_invalid` and `data.violations`, and SHALL NOT call the handler
5. WHEN a middleware throws THEN the dispatcher SHALL propagate that error without interpreting the input - `PATCH /me` with no token and an invalid body answers `401`
6. WHERE the handler declares no `input` the dispatcher SHALL hand `{}` in `inbound.input`
7. The system SHALL give every mounted handler a `name` matching `/^[a-z][a-z0-9]*\.[a-z][a-z0-9_]*$/`, unique across every mounted route
8. The system SHALL expose on every mounted handler an input schema (its `input`, or the empty object) whose JSON equals its own JSON round trip and has `type: "object"`
9. WHEN a route runs THEN the system SHALL add `operation: <handler name>` to the request's log context

**Independent test:** a test handler with `input` receives the input converted by the dispatcher, and one with invalid input is never called.

### S2: Violations in the JSON Schema vocabulary (P1)

A refusal names the field and the JSON Schema keyword that failed.

**Acceptance Criteria**

10. WHEN a value breaks a keyword THEN the system SHALL emit `{ field, reason }` with `reason` equal to the keyword - a 5-character password against `minLength: 12` gives `{ field: "password", reason: "minLength" }`
11. WHEN required properties are missing THEN the system SHALL emit one violation `{ field: <path of the property>, reason: "required" }` for each, in schema order
12. The system SHALL write `field` as the dotted path (`items.1.name`), and `""` when the failure is at the root
13. The system SHALL NOT repeat the same `field`/`reason` pair in one refusal
14. The system SHALL make `SchemaParser.safeParse` return `{ ok: true, data }` or `{ ok: false, violations }` without throwing, and `SchemaParser.parse` throw `shared.input_invalid` (or the error definition passed) with the same violations

**Independent test:** `SchemaParser.safeParse` over an object with a missing field, a short password and an invalid nested item returns the three expected violations.

### S3: Every caller runs on TypeBox (P1)

The in-house validator goes away without changing what each route accepts.

**Acceptance Criteria**

15. The system SHALL keep the path, success status and accepted inputs of the 22 identity routes that read input: the current e2e specs pass, changing only the expected `reason` values
16. The system SHALL make `loadEnv` accept and refuse the same environments as today: `config.spec.ts` passes without changing any expected `field`, including `MONGO_URL: "   "` refused and the 10 missing required variables named at once
17. IF an OAuth provider answers a body outside the expected shape THEN `FetchOAuthGateway` SHALL keep failing with `unexpected_body`
18. The system SHALL NOT have `src/shared/application/validator`, and no file in `src` SHALL import that path

**Independent test:** `pnpm test:coverage` passes at 100% with the validator directory removed.

## Out of scope

| Excluded                                             | Why                                                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `/mcp` endpoint exposing the handlers as tools       | next feature, on this foundation (user's choice)                                                       |
| OpenAPI generation                                   | planned in STACK.md; uses the same `input`, its own feature                                            |
| CPF/CNPJ, `bigint`, `date`, `uuid`, `record` schemas | no caller outside the validator; they come back as a TypeBox format or refine when a module needs them |
| per-field `description`                              | no consumer reads it yet; the MCP binding decides                                                      |
| raising TypeBox's 8-error limit (`maxErrors`)        | the limit protects against huge input; a form with more than 8 errors is rare                          |

## Assumptions

| Assumption                                             | Chosen default                                                                                                                                                                                                                                                                                         | Rationale                                                                                                                             | Confirmed? |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| violations per refusal                                 | TypeBox's default (8 errors), before expanding `required`                                                                                                                                                                                                                                              | protection against huge input with no code of ours                                                                                    | n          |
| empty text in a numeric field                          | becomes `0` (TypeBox's conversion)                                                                                                                                                                                                                                                                     | only `config` reads numbers from text today, and `PORT`/`TRUST_PROXY` have bounds                                                     | n          |
| e-mail with surrounding spaces                         | refused with `format`                                                                                                                                                                                                                                                                                  | the client trims; the domain keeps normalizing                                                                                        | n          |
| `docs/validator-url.md` and `validator-process-env.md` | leave the repo                                                                                                                                                                                                                                                                                         | they describe code that no longer exists here; `vale` has its own history                                                             | n          |
| where `SchemaParser` and the ObjectId rule live        | `SchemaParser` in `src/shared/presentation/`; the ObjectId rule is the string `OBJECT_ID_PATTERN` (`^[0-9a-fA-F]{24}$`) exported by `Id` in `src/shared/domain/value-objects/id.value-object.ts`, which `Id` itself checks with, and each handler writes `Type.String({ pattern: OBJECT_ID_PATTERN })` | user: application and domain know no library, and handlers import only the pattern string; one source for what an ObjectId looks like | y          |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface                             | Decision              | Landing                                                              |
| ----------------------------------- | --------------------- | -------------------------------------------------------------------- |
| API every identity route with input | error shape and codes | AC 10, AC 11, AC 12, AC 13                                           |
| API every identity route with input | response shape        | AC 15                                                                |
| API every identity route with input | who may call it       | existing - `AuthenticateMiddleware` before the interpretation (AC 5) |
| API every identity route with input | rate limit            | existing - `RateLimitMiddleware` before the interpretation (AC 5)    |
| API every identity route with input | versioning            | n/a - unversioned API with no published client reading `reason`      |

## Sources

- `docs/adr/001-transport-neutral-handler-layer.md` - one handler per operation, MCP binding planned
- user decisions on 2026-10-30: TypeBox instead of the validator; `reason` = JSON Schema keyword; scope is the declarative handler only
- `typebox` 1.3.37 (`readme.md` and the package types) - API of `Type`, `Value`, `Codec` and the error shape
