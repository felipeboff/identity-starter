# ADR-005: TypeBox Input Schemas Declared on the Handler

- **Date**: 2026-10-30
- **Status**: Accepted
- **Deciders**: Felipe Boff
- **Tags**: architecture, validation, mcp, api-contract, dependencies

## Context and Problem Statement

Each handler validated its input inside `handle`, with a schema from the in-house validator
(`src/shared/application/validator`, kept in three copies: identity-starter, `vale`, linkio). Nothing
outside the handler could learn which input an operation accepts or what it is called without
running it. The planned MCP binding (ADR-001) and OpenAPI both need that input as JSON Schema and a
stable operation name, and the in-house validator could not describe itself as JSON Schema.

## Decision Drivers

- MCP and OpenAPI read the input of every operation as JSON Schema
- One description per operation, shared by HTTP, MCP and messages
- Less in-house code to write, test to 100% and port between copies
- The repo runs TypeScript 6 and ESM

## Considered Options

- TypeBox 1.x, input and name declared on the handler, validated by the dispatcher
- Keep the in-house validator and teach it to emit JSON Schema
- Valibot
- Name and schema on each transport binding (`McpTool = Entry & { name }`, as ADR-001 sketched)

## Decision Outcome

Chosen option: **TypeBox 1.x, declared on the handler**, because a TypeBox schema already is JSON
Schema, so the description cannot drift from the validation, and declaring it on the handler gives
every transport the same input.

- `Handler` gains `abstract readonly name` (`<module>.<operation>` in snake_case, e.g.
  `identity.sign_in_with_email`) and `readonly input` (a TypeBox schema; none means the empty
  object). `handle` receives `Inbound<TActor, StaticDecode<input>>`.
- `Dispatcher` interprets the input after the middlewares through `SchemaParser`, which lives
  next to it in `src/shared/presentation`: `Clone` -> `Default` -> `Convert` -> `Clean` ->
  `Errors` -> `Decode`. Domain and application import no library (an ESLint rule enforces it). A refusal throws `shared.input_invalid` with `data.violations` =
  `{ field, reason }`, where `reason` is the JSON Schema keyword (`minLength`, `format`,
  `required`...) and `field` is the dotted path.
- This replaces the ADR-001 lines saying that `Handler.handle` validates `inbound.input` with a `v`
  schema (`probe`) and that `v.object` drops unknown keys; `Clean` drops them now.

### Positive Consequences

- MCP and OpenAPI read `handler.input` directly; the operation name is stable and unique
- No in-house validator to maintain here; `typebox` has no dependencies of its own
- Handlers no longer repeat the `probe` call, and their input is typed by the schema

### Negative Consequences

- `reason` changed vocabulary (`min_length` -> `minLength`): a public contract change
- `Convert` truncates text into `Type.Integer` (`"12.5"` -> `12`); a whole number that must
  refuse a fraction is `Type.Number({ multipleOf: 1 })`
- TypeBox stops at 8 errors per refusal (`maxErrors`), so a very bad input lists at most 8
- No trimming or lower-casing at the edge; normalization stays in value objects

## Pros and Cons of the Options

### TypeBox 1.x on the handler ✅ Chosen

- ✅ Schema is JSON Schema 2020-12; built for TypeScript 6/7, ESM, zero dependencies
- ❌ A dependency at the edge of every module, and a reason vocabulary we do not own

### In-house validator emitting JSON Schema

- ✅ No new dependency, our own reason codes
- ❌ Every format, fix and generator stays ours, in three copies

### Valibot

- ✅ Small, typed pipelines
- ❌ JSON Schema only through a converter that cannot describe `transform` or custom checks

### Schema and name on each binding

- ✅ Transport-specific names and descriptions
- ❌ HTTP, MCP and queue would describe the same input three times

## Links

- Partly supersedes: [ADR-001: Transport-Neutral Handler Layer](001-transport-neutral-handler-layer.md) (input validation lines)
- Feature: `.specs/features/typebox-handler/plan.md`
