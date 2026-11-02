# ADR-011: Every Use Case Declares Its Access

- **Date**: 2026-11-02
- **Status**: Accepted
- **Deciders**: Felipe Boff
- **Tags**: architecture, application, authorization, api-contract
- **Supersedes in part**: [ADR-006](006-use-cases-declare-required-permissions.md) - the optional
  props and the role as a label

## Context and Problem Statement

ADR-006 put the required permissions on the use case as two optional props, `permissions` and
`anyPermissions`, and a third one, `roles`, came later. An absent prop meant "no fixed
requirement". In identity, 15 of the 22 use cases with an actor declared nothing, for three
different reasons that looked the same: open to any member on purpose (`get-me`), a rule that
depends on the target checked in the body (`revoke-session`), or a forgotten declaration. The
third case compiles, passes every test, and opens the operation to any signed-in member.

## Decision Drivers

- Forgetting the requirement must fail where the use case is written, not in production
- "Open to any member" must read differently from "forgot"
- One place to read what a use case requires
- `shared` still imports nothing from a module; the types come from the use-case shape

## Considered Options

- One required `access` on every use case, typed from the shape
- Required props only on use cases with an actor, through a second base class
- A convention test listing the use cases with an actor and their declarations
- Keep the optional props (ADR-006)

## Decision Outcome

Chosen option: **one required `access` on every use case**. `UseCase` declares
`abstract readonly access`, whose type depends on the shape: without an actor it accepts only
`Access.ANYONE` (public routes, outbox consumers, scripts); with one, `Access.MEMBER` (any actor;
a rule that depends on the target stays in the body) or a requirement with at least one of
`permissions` (all of them), `anyPermissions` (one of them) and `roles` (one of them), typed from
the actor's permission codes and role. The base checks them in that order before `execute` runs,
as in ADR-006, and refuses with `403 shared.permission_missing` or `403 shared.role_missing`
listing the accepted roles in `data.roles`. A role is no longer only a label: a use case may
require one, and none in identity does yet.

### Positive Consequences

- A use case without `access`, `Access.ANYONE` on one with an actor, a requirement on one
  without, an empty requirement, an unknown code or an unknown role: none of them compiles
- `Access.MEMBER` says on purpose what an absent prop used to say by accident
- The answers of the API do not change

### Negative Consequences

- Every use case carries one more line, `Access.ANYONE` included
- `Access.MEMBER` still does not tell "open to any member" from "checked in the body"; the body
  has to be read for the four identity use cases that check the target
- A use case whose `access` is missing at runtime (only possible past the compiler) fails with a
  `TypeError`, a `500`, rather than a `403`
- The check is still invisible inside `execute` (ADR-006)

## Pros and Cons of the Options

### One required `access` ✅ Chosen

- ✅ The compiler enforces the decision on every use case, with no second base class
- ❌ Public use cases declare something too

### Required props through a second base class

- ✅ Public use cases declare nothing
- ❌ Two bases to choose from, and a protected use case can still pick the wrong one

### A convention test

- ✅ No change to the base
- ❌ The mistake shows up in a test run, not where the use case is written

### Keep the optional props

- ✅ No migration
- ❌ A forgotten declaration stays silent

## Links

- Supersedes in part: [ADR-006: Use Cases Declare Required Permissions, Checked by the UseCase Base](006-use-cases-declare-required-permissions.md)
- Front-end contract: [`docs/auth-front-end-contract.md`](../auth-front-end-contract.md) (Permissions)
