# ADR-006: Use Cases Declare Required Permissions, Checked by the UseCase Base

- **Date**: 2026-10-30
- **Status**: Accepted
- **Deciders**: Felipe Boff
- **Tags**: architecture, application, authorization, api-contract

## Context and Problem Statement

Who may call an identity use case was code inside `execute`: `accessPolicy.ensureAdmin(actor)` or
`ensureCanInvite(actor)` on the first line. A new use case was only protected if its author
remembered the call and put it before any read, and an inventory of "who requires what" meant
reading every body. The rules also read the membership's `role`: the `admin` role overrode
`invite`, "grant only what you hold" and "act on someone else's account", while the `admin`
permission could be granted but was read nowhere.

## Decision Drivers

- The permission a use case requires is readable at a glance, as data
- The check runs before any read or write, so a refusal never leaks whether a record exists
- `shared` never imports a module, so the base cannot know identity's permission enum
- Access depends on permissions only; a role is a label (`admin`, `user`, `finance`...)
- A generic code (`admin`, `write`) says nothing about which operation it opens

## Considered Options

- Two optional props on the use case, checked by the `UseCase` base
- `accessPolicy.ensureX(actor)` in each body (the status quo)
- A `permission` field on the `HttpRoute`
- A single prop with a mode (`{ all: [...] }` / `{ any: [...] }`)

## Decision Outcome

Chosen option: **two optional props on the use case**. `readonly permissions` requires every code;
`readonly anyPermissions` requires at least one, checked after `permissions`. Both are typed from
the actor in the use-case shape (`S extends { actor: { permissions: readonly (infer P)[] } }`), so
`shared` imports nothing from identity and a shape without `actor` cannot declare them. The base
wraps `execute` in its constructor, looks the subclass method up on the prototype at call time,
and refuses with `403 shared.permission_missing`: `data.required` (first missing code) or
`data.anyOf` (the declared list). An empty or absent list requires nothing.

Each use case that requires a permission has its own code, named `<subject>.<action>`
(`invitation.create`, `account.reactivate`, `member.permissions.update`...); the generic `read`,
`write`, `delete`, `admin` and `invite` are gone. Rules that depend on the input stay in
`AccessPolicy` and keep `403 identity.forbidden`: the account owner or a holder of the operation's
code, and nobody grants in an invitation a code they do not hold. `Actor` keeps `role` as a label
no rule reads. A use case whose only use of the actor is the check names the parameter `_actor`,
and ESLint ignores parameters starting with `_`.

### Positive Consequences

- Each use case states its codes in its first lines; an inventory is a grep
- Refusal happens before any data access
- One error code for a missing permission, whatever the module

### Negative Consequences

- The check is not visible inside `execute`; a reader must know the base runs it
- An absent prop means "no fixed requirement" and does not tell it apart from "checked in the body"
- A member with the `admin` role and no permissions has no powers, and memberships stored with the
  old generic codes fail validation; existing data needs the new codes granted by hand
- A new protected use case adds a code, and someone has to grant it before anyone can call it
- Nothing in the type stops a future rule from reading `actor.role`
- Refusals by declared permission changed code (`identity.forbidden` → `shared.permission_missing`)

## Pros and Cons of the Options

### Two optional props ✅ Chosen

- ✅ Covers "all of these" and "one of those", alone or together
- ❌ Absence is not enforced by the compiler

### `ensureX` in each body

- ✅ Every rule in one place, visible in the body
- ❌ The requirement is not data, and its position is up to whoever writes the use case

### `permission` on the `HttpRoute`

- ✅ Visible next to the route
- ❌ A direct `execute` call (a job, another transport) bypasses it

### A single prop with a mode

- ✅ One prop to learn
- ❌ Cannot express "all of these and one of those" at once

## Links

- Feature: `.specs/features/use-case-permissions/plan.md`
- Pattern adapted from linkio `docs/adr/010-use-case-declared-permissions.md`
- Front-end contract: [`docs/auth-front-end-contract.md`](../auth-front-end-contract.md) (Permissions)
