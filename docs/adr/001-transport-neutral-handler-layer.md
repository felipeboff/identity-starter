# ADR-001: Transport-Neutral Handler Layer with Per-Transport Bindings

- **Date**: 2026-10-24
- **Status**: Accepted; input validation lines superseded by [ADR-005](005-typebox-input-schemas-declared-on-the-handler.md)
- **Deciders**: Felipe Boff
- **Tags**: architecture, http, mcp, messaging, api-contract, errors

## Context and Problem Statement

Use cases can only be called from TypeScript. They will be reached from three edges: HTTP (Express
first, through an adapter), MCP tools and RabbitMQ consumers. Each edge receives something
different (a request, tool arguments, a message) and answers differently (status + body, tool
content, ack/nack), but the step in the middle is always the same: validate what came in, turn it
into the use case's input, attach who is calling and call the use case.

A first contract written in HTTP vocabulary (`HttpRequest` with `params`, `query`, `body`,
`headers`; handlers returning status codes) made MCP and messages translate into HTTP shapes, and
its generics grew until a middleware could not change the actor type.

## Decision Drivers

- One handler per entry point, reused by HTTP, MCP and RabbitMQ
- Swapping or adding a transport must not touch module code
- Cross-cutting steps (authentication) written once for every transport
- Few generics: the input is typed by its validation schema, not by the contract
- One public HTTP error contract, recognisable by standard tooling

## Considered Options

- Transport-neutral `Handler` + `Middleware`, bound to each transport by a small declaration
- One contract per transport (`HttpHandler`, `MessageHandler`, MCP reusing HTTP routes)
- Handlers written directly against Express (or Fastify) request/response types

## Decision Outcome

Chosen option: **transport-neutral `Handler` + `Middleware` with per-transport bindings**, because
every identity handler does the same three things (validate, call the use case, answer with a
fixed success status), so the HTTP-specific parts belong to the binding and the adapter, not to
the handler.

`src/shared/presentation/handler.ts`:

- `Inbound<TActor>` = `{ input, metadata, ip, actor }`. `input` is `unknown` and merged by the
  adapter; `metadata` holds lower-case header-like values; `actor` is `undefined` until a
  middleware sets it.
- `Handler` and `Middleware` are abstract classes shaped like `UseCase`: a shape object
  (`{ deps, actor, output }` / `{ deps, actor, nextActor }`) and `constructor(protected readonly deps)`.
- `Handler.handle(inbound)` validates `inbound.input` with a `v` schema (`probe`) and returns the
  use case's output.
- `Middleware.handle(inbound, next)` may hand a changed inbound on (authentication:
  `undefined` -> `Actor`, declared as `nextActor`) or answer without calling `next`.
- `Entry<TActor>` = `{ middlewares?, handler }`, shared by every binding.
- Errors are thrown up the chain. Each adapter catches them once and translates them.

Bindings:

| Transport | Binding                                                   | `input` built from                 | Success                                      | Errors                                                                                                                           |
| --------- | --------------------------------------------------------- | ---------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| HTTP      | `HttpRoute` = `Entry & { method, path, status }`          | `{ ...query, ...body, ...params }` | `status` from the route; `204` sends no body | RFC 9457 problem details; `ErrorKind` -> 400/401/403/404/409/422; anything else `500` `shared.internal`, sent to `ErrorReporter` |
| MCP       | `McpTool` = `Entry & { name, description }` (when needed) | tool arguments as they are         | output as JSON content                       | tool error result carrying `code` and `data`                                                                                     |
| RabbitMQ  | `MessageConsumer` = `Entry & { queue }` (when needed)     | message payload                    | output ignored, ack                          | `AppError`: ack and log (business refusal); anything else: nack / retry                                                          |

`params` are spread last so a body field can never override a path id; `v.object` drops keys not
in its shape, so one schema per handler reads the merged input. The HTTP error body keeps
`type: "tag:resolve-hub,2026:<code>"`, a `title` derived from the code, and `code` / `data`
extension members (`HttpResponse` and `ProblemDetails` in `src/shared/presentation/http`).

This replaces the earlier HTTP-only ADR-001 and overrides the matching decisions in
`.specs/features/http-handler/plan.md` (doors 1, 4, 7 and 8) and
`.specs/features/identity-http/plan.md` (door 2 now reads `metadata.authorization`).

### Positive Consequences

- One handler serves HTTP, MCP and RabbitMQ; a new transport is one binding type and one adapter
- Authentication is written once as a middleware and works for any transport that carries a token
- The contract has one generic per concept; the input type comes from the schema
- Handlers are a few lines: validate, call, return

### Negative Consequences

- A handler looks close to its use case; its value is validation and actor wiring
- Success status per outcome (200 vs 201) and success headers (`Location`, cookies) need an
  explicit extension of `HttpRoute` or of the handler output when a route needs them
- A middleware cannot add headers to the HTTP response; request ids and similar belong to the adapter
- Middleware typing across a chain is checked per hop, not end to end

## Pros and Cons of the Options

### Transport-neutral `Handler` + bindings ✅ Chosen

- ✅ One entry point per use case for every transport; MCP and messages see no HTTP vocabulary
- ✅ Simple contract: no `Resolve*` generics, no response builders
- ❌ HTTP-only features (status per outcome, success headers) need an explicit extension

### One contract per transport

- ✅ Each transport keeps its full vocabulary (status codes, ack/nack)
- ❌ The same validate-and-call code is repeated per transport, or MCP has to fake HTTP requests

### Handlers written against Express or Fastify types

- ✅ No translation layer; the framework middleware ecosystem is available directly
- ❌ Switching framework rewrites every handler; MCP and RabbitMQ cannot reuse them

## Links

- `.claude/skills/STACK.md` - "Runtime and HTTP"
- `.specs/features/http-handler/plan.md`, `.specs/features/identity-http/plan.md` - partly overridden, see above
- RFC 9457 - Problem Details for HTTP APIs
