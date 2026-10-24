# ADR-001: Framework-Neutral HTTP Handler Layer with RFC 9457 Errors

- **Date**: 2026-10-22
- **Status**: Accepted
- **Deciders**: Felipe Boff
- **Tags**: architecture, http, api-contract, errors

## Context and Problem Statement

Use cases can only be called from TypeScript; there is no route and no client yet. The HTTP
framework is not settled (Express or Fastify), and the same use cases will also be exposed as MCP
tools. Whoever writes the first route would otherwise decide, by accident, how a request reaches
module code, which status each `AppError` kind gets, what an error body looks like and where
authentication runs - and every route would be written against one framework's types.

## Decision Drivers

- Swapping or adding a framework must not touch module code
- MCP tools should reuse the same entry points as HTTP routes
- One public error contract, decided once, recognisable by standard tooling
- Cross-cutting steps (authentication, request id, logging) written once for every adapter

## Considered Options

- Framework-neutral `HttpHandler` + `HttpRoute` + `HttpMiddleware`, driven by thin adapters
- A transport-neutral handler taking `{ input, actor }`
- Handlers written directly against Express (or Fastify) request/response types

## Decision Outcome

Chosen option: **framework-neutral `HttpHandler` + `HttpRoute` + `HttpMiddleware`** in
`src/shared/interfaces/http`, because it keeps `params`, `query`, `body` and `headers` apart (which
a handler needs for `Location`, conditional headers and path ids) while importing no framework.
Each module exports `HttpRoute`s; Express, Fastify and MCP adapters walk the same list. The MCP
adapter builds an `HttpRequest` from the tool arguments (`:param` names go to `params`).

`HttpDispatcher` runs global middlewares, then route middlewares, then the handler. Anything thrown
becomes an error result where it happens, so `next()` and `dispatch()` never reject. Errors follow
RFC 9457 (`application/problem+json`): `type` is `tag:resolve-hub,2026:<code>`, `title` derives
from the code, plus `code` and `data` extension members. `ErrorKind` maps to 400 / 401 / 403 /
404 / 409 / 422; anything else is a bare `500` with code `shared.internal`, reported through the
`ErrorReporter` port.

### Positive Consequences

- A framework swap is one new adapter; handlers, routes and middlewares stay
- Authentication written as one middleware serves HTTP and MCP alike
- Clients branch on a stable `code`; generic tooling understands the body shape
- Adding an `ErrorKind` is a compile error until it gets a status

### Negative Consequences

- MCP tools see HTTP vocabulary (`params`, `query`, status codes) and need an argument-mapping rule
- Middleware typing across a route's chain is checked per hop, not end to end
- The `tag:` year `2026` is frozen; changing it breaks clients that compare `type`
- Framework-specific features (cookies, streaming) need an explicit extension later

## Pros and Cons of the Options

### Framework-neutral `HttpHandler` + `HttpRoute` + `HttpMiddleware` ✅ Chosen

- ✅ No framework type below the adapter; one route list for three adapters
- ✅ Handler keeps full HTTP expressiveness (status per outcome, headers)
- ❌ MCP adapter must translate flat tool arguments into request parts

### Transport-neutral handler taking `{ input, actor }`

- ✅ Fits MCP's flat arguments naturally
- ❌ Loses path, query and headers; the handler becomes a copy of the use case

### Handlers written against Express or Fastify types

- ✅ No translation layer, framework middleware ecosystem directly available
- ❌ Switching framework rewrites every route; MCP cannot reuse them

## Links

- Feature plan: `.specs/features/http-handler/plan.md`
- RFC 9457 - Problem Details for HTTP APIs
- `.claude/skills/STACK.md` - "Runtime and HTTP"
