# ADR-015: Modules Declare Their Permissions in One Catalog

- **Date**: 2026-11-02
- **Status**: Accepted
- **Deciders**: Felipe Boff
- **Tags**: architecture, authorization, modules, api-contract
- **Supersedes in part**: [ADR-006](006-use-cases-declare-required-permissions.md) - the
  `<subject>.<action>` naming of the codes

## Context and Problem Statement

The permission codes that existed were one closed list inside identity's domain,
`MembershipPermission`, checked by the `Membership` and `Invitation` entities, the persistence
schemas and the HTTP schemas. A product module added to the boilerplate could only protect a use
case by editing identity's domain, which breaks the rule that modules meet only through
`@/<module>/public`. The entities also checked the list on `restore`, so removing a code made every
membership that still stored it fail to load. And the codes did not name their module, so a
`billing` module could not use `account.read`.

## Decision Drivers

- A new module protects its use cases without touching identity
- The set of codes is a fact of which modules the process mounts, known before identity is built
- A stored code that leaves the set must not block loading or editing a membership
- Codes must not clash between modules, and the rule must be enforced, not documented
- `shared` imports no module

## Considered Options

- A catalog assembled in `src/app` from each module's declaration, checked at boot
- Keep the closed list in identity and let modules add to it
- Each module registers its codes with identity when it is created

## Decision Outcome

Chosen option: **a catalog assembled in `src/app`**. Each module declares a `ModulePermissions`
(`{ module, permissions }`) from a `const` in its own domain and exports it next to its
`create<Module>Module`; `src/app/permission-catalog.ts` builds one `PermissionCatalog` (in
`shared/domain`) from every declaration, used by `start` and by `scripts/grant-admin.ts`. The
constructor refuses a repeated code, a code without the `<module>.` prefix or one outside
`^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$` (up to 100 characters) with
`shared.invalid_permission_catalog`, so a bad catalog stops the boot. Identity's codes become
`identity.<subject>.<action>`.

Identity gets the catalog through `IdentityRuntime`. The entities store any code; `AccessPolicy`
refuses an **added** code outside the catalog with `400 identity.invalid_membership_permissions`
before it checks what the actor holds, and removing a code outside the catalog does not need the
actor to hold it. `grant-admin` stores exactly the catalog, and `GET /permissions` lists it to any
member. Codes outside the catalog stay inert: no `access` requires them.

### Positive Consequences

- A module's codes are a `const` in its domain plus one line in `src/app/permission-catalog.ts`
- `restore` never fails because of a code; a removed module leaves codes that grant nothing and can
  be removed from a member
- The prefix rule and uniqueness are enforced at boot
- The front end reads the grantable codes from `GET /permissions` instead of a copied list

### Negative Consequences

- `Actor.permissions` is `string[]`: a typo in `access` is caught only by using the module's `const`
- Renaming a code is a data change: stored memberships and invitations keep the old code, inert,
  until someone grants the new one (identity's own rename went that way, with no migration, since
  no deployment had data)
- A new module's codes reach nobody until an administrator grants them, usually by running
  `pnpm identity:grant-admin` again
- The input and output schemas check the format of a code, so the OpenAPI document no longer lists
  the accepted values

## Pros and Cons of the Options

### Catalog assembled in `src/app` ✅ Chosen

- ✅ Built from constants, so it exists before any module is created
- ✅ The composition root already knows which modules the process mounts
- ❌ One more file to edit when adding a module

### Closed list in identity

- ✅ No new concept
- ❌ Every module edits identity's domain
- ❌ `restore` fails when a code leaves the list

### Each module registers with identity when created

- ✅ No list in `src/app`
- ❌ Depends on creation order, and identity is created first
- ❌ Needs a mutable catalog

## Links

- Plan and checks: `.specs/features/permission-catalog/`
- Supersedes in part: [ADR-006: Use Cases Declare Required Permissions, Checked by the UseCase Base](006-use-cases-declare-required-permissions.md)
- Related: [ADR-011: Every Use Case Declares Its Access](011-every-use-case-declares-its-access.md)
- Front-end contract: [`docs/auth-front-end-contract.md`](../auth-front-end-contract.md) (Permissions)
