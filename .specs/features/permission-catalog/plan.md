# Permission catalog

## Problem

Today the permissions that exist are a closed list inside identity's domain: the
`MembershipPermission` in `membership.entity.ts`, checked by the `Membership` and `Invitation`
entities, by the persistence schemas and by the TypeBox input and output schemas. Whoever clones
the boilerplate and creates the first product module (an `orders` that needs `order.create`) can
only protect a use case by editing identity's domain. That breaks the boundary between modules
(only `@/<module>/public`) and the promise of "Making it yours" that the next commit is about the
product.

The same closed list hides a defect: the `Membership` constructor checks the permissions on
`restore` too. Taking a code out of the list makes every membership that still stores it fail to
load.

Today's codes also do not say which module they come from (`account.deactivate`, `member.read`,
`session.read`): a `billing` module could not use `account.read` without a clash.

There is no usage evidence to quote: nobody uses the app yet (confirmed by the user on
2026-11-02), so there is no real data to migrate.

When this ships: a module declares its own permissions in its own domain, `src/app` gathers them
into one catalog, and inviting, changing permissions and `grant-admin` accept any code in the
catalog without touching identity. The front end and integrators find the codes at
`GET /permissions`.

## Flow

Reuses the `UseCase` `access` (ADR-006, ADR-011), the `AccessPolicy` ("nobody grants what they do
not hold"), the `identity.invalid_membership_permissions` error the front end already translates,
and the `IdentityRuntime` through which `start` already hands over the process dependencies.

1. each module declares a `ModulePermissions` (`{ module, permissions }`) from the `const` in its
   own domain (door 2) -> `src/app` (exists) gathers the declarations into a `PermissionCatalog`
   (door 1), once, before creating identity; a repeated code or one outside the module's prefix
   stops the boot
2. `src/app/start.ts` and `scripts/grant-admin.ts` (exist) hand the catalog over through the
   `IdentityRuntime` -> `src/modules/identity/identity.module.ts` (exists)
3. `POST /invitations` (exists) and `PUT /members/:accountId/permissions` (exists) ->
   `src/modules/identity/application/use-cases` (exists) check the **added** codes against the
   catalog (`400 identity.invalid_membership_permissions`), only then the `AccessPolicy` (`403`),
   and persist `Invitation` / `Membership` with the codes as they came (door 5)
4. `pnpm identity:grant-admin` -> `GrantAdminUseCase` (exists) stores exactly `catalog.all()`
5. `GET /permissions` (door 4) -> a new use case in `src/modules/identity/application/use-cases`
   (no door, placed by the conventions) returns the catalog
6. any authenticated route -> `AuthenticateUseCase` (exists) loads the membership as it is; a code
   outside the catalog reaches the `Actor`, but no `access` requires it

## Impact

| Front             | What changes                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| domain            | new term: `PermissionCatalog` - the codes that exist in this process, assembled in `src/app` from the modules' declarations; lives in `src/shared` and imports no module                                                                                                                                                                                                         |
| domain            | new term: `ModulePermissions` - a module's declaration: the module name and its codes                                                                                                                                                                                                                                                                                            |
| domain            | existing term: `MembershipPermission` meant "every permission that exists"; it becomes `IdentityPermission`, only identity's. Who branches on it today: the 11 use cases with `access`, `AccessPolicy`, `Actor`, `GrantAdminUseCase`, the persistence and TypeBox schemas, the tests' `identity-context` and `public.ts` (exports the name; no other module exists to import it) |
| domain            | existing term: `Actor.permissions` and the `AccessPolicy` parameters were typed with identity's enum; they become `string`. Protection against a typo in `access` comes from using the module's `const`                                                                                                                                                                          |
| domain            | `Membership` and `Invitation` stop comparing the codes with the list; `restore` never fails again because of an unknown code                                                                                                                                                                                                                                                     |
| behaviour         | identity's 11 codes get the `identity.` prefix (door 3); membership and invitation responses and the `403 shared.permission_missing` carry the new codes                                                                                                                                                                                                                         |
| behaviour         | `PUT /members/:accountId/permissions`: only the added codes must exist in the catalog, and removing an unknown code does not require the actor to hold it (door 5)                                                                                                                                                                                                               |
| behaviour         | `POST /invitations` with an unknown code answers `400` before the `AccessPolicy`'s `403` (in today's use case the `403` comes first)                                                                                                                                                                                                                                             |
| behaviour         | the input and output schemas swap the enum for a format pattern; a code outside the format still answers `400 shared.input_invalid`                                                                                                                                                                                                                                              |
| stored data       | nothing to migrate, because nobody uses the app yet: memberships and invitations with old codes keep inert codes, and the admin runs `pnpm identity:grant-admin` again. The `enum` leaves the membership and invitation persistence schemas                                                                                                                                      |
| front-end example | `web/`: codes renamed in `identity.types.ts`, in the explorer's route catalog and in i18n; the members page and the overview list the permissions from `GET /permissions`, the invitations page keeps listing what the inviter holds, and every label is the i18n one or the code itself when there is no translation; the explorer gains the new route                          |
| docs              | new ADR-015 (catalog declared per module, module prefix), superseding in part ADR-006 (the `<subject>.<action>` convention); `docs/auth-front-end-contract.md` (permissions table and `GET /permissions`); readme ("Making it yours": how a module declares permissions and runs `grant-admin` again; permission list)                                                           |

## Relations

`None - memberships and invitations still store a list of codes; only the enum leaves the persistence schemas (see Impact)`

## Surface

| Route                                 | In                                                                | Out                                                | Status                                   |
| ------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------- |
| `GET /permissions`                    | bearer of an authenticated member                                 | `permissions`: list of codes in alphabetical order | `200`, `401`                             |
| `POST /invitations`                   | `email`, `role`, `permissions` (any catalog code, in the pattern) | `invitation` (shape unchanged)                     | `201`, `400`, `401`, `403`, `422`        |
| `PUT /members/:accountId/permissions` | `permissions` (added ones in the catalog; stored ones may stay)   | `membership` (shape unchanged)                     | `200`, `400`, `401`, `403`, `404`, `422` |

## Landing

| One-way door                                     | Literal shape                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Alternative rejected                                                                                                                                                                                                                     |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. catalog assembled in the app, checked at boot | `new PermissionCatalog([identityPermissions, ...])` in a single `src/app` file, used by `start.ts` and by `scripts/grant-admin.ts`; the constructor refuses a repeated code or one without the `<module>.` prefix with `shared.invalid_permission_catalog`                                                                                                                                                                                                                   | checking in identity's domain: the set depends on which modules are installed (a composition fact) and breaks `restore`; each module registering with identity when it is created: depends on creation order and needs a mutable catalog |
| 2. how a module declares                         | `export const OrdersPermission = { ORDER_CREATE: "orders.order.create" } as const` in the module's `domain/`, and `export const ordersPermissions: ModulePermissions = { module: "orders", permissions: Object.values(OrdersPermission) }` next to `create<Module>Module`                                                                                                                                                                                                    | a `permissions` field on the object `create<Module>Module` returns: the modules would have to be created before the catalog, but identity needs the catalog when it is created                                                           |
| 3. code convention and prefix                    | `<module>.<subject>.<action>`, lowercase and `_`, pattern `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$`, up to 100 characters. Identity's 11: `identity.invitation.create`, `identity.invitation.read`, `identity.invitation.revoke`, `identity.account.reactivate`, `identity.account.deactivate`, `identity.session.read`, `identity.session.revoke`, `identity.session.revoke_all`, `identity.member.read`, `identity.member.role.update`, `identity.member.permissions.update` | keeping no prefix: a `billing` could not use `account.read`, and the catalog would have no way to enforce the convention                                                                                                                 |
| 4. catalog route                                 | `GET /permissions` -> `200 { "permissions": ["identity.account.deactivate", ...] }`, flat list in alphabetical order, `Access.MEMBER`                                                                                                                                                                                                                                                                                                                                        | grouping by module (`[{ module, permissions }]`): redundant with the prefix and more contract to keep; requiring `identity.member.read`: whoever invites also needs to see the list                                                      |
| 5. codes outside the catalog are inert           | the domain stores and returns any code in the pattern; only an **added** code must exist in the catalog; removing an unknown code does not go through the "nobody changes what they do not hold" rule                                                                                                                                                                                                                                                                        | refusing the whole list when a stored code left the catalog: the members page sends the whole list in the `PUT`, and the membership would be stuck until someone edited the data by hand                                                 |

- Nothing else in this change is hard to reverse

## Criteria

### S1: a module declares permissions and identity accepts them (P1)

A code declared by another module can be granted by invitation, by a permissions change and by
`grant-admin`, without editing identity.

**Acceptance Criteria**

1. WHEN a member holding `identity.invitation.create` and `orders.order.create` invites someone with `permissions: ["orders.order.create"]`, and the catalog contains the `orders` declaration, THEN the system SHALL answer `201` with `invitation.permissions` equal to `["orders.order.create"]`
2. WHEN a member holding `identity.member.permissions.update` and `orders.order.create` sends `PUT /members/:accountId/permissions` adding `orders.order.create` THEN the system SHALL answer `200` with the code in `membership.permissions`
3. IF `POST /invitations` or `PUT /members/:accountId/permissions` receives an added code, in the pattern, that is not in the catalog THEN the system SHALL answer `400 identity.invalid_membership_permissions` with `data.permissions` equal to the unknown codes, even when the actor does not hold those codes
4. IF a code in `permissions` does not follow the `<module>.<segment>` pattern or is longer than 100 characters THEN the system SHALL answer `400 shared.input_invalid`
5. WHEN `pnpm identity:grant-admin <email>` runs THEN the account's membership SHALL have the `admin` role and exactly the codes of `catalog.all()`, other modules' codes included

**Independent test:** with a test catalog that includes `orders`, run `grant-admin` on one
account, invite another with `orders.order.create` and see the code in the response.

### S2: the catalog is checked at boot and identity uses the prefix (P1)

An inconsistent catalog does not start, and identity's `access` rules require the prefixed codes.

**Acceptance Criteria**

6. IF two declarations contain the same code THEN building the catalog SHALL fail with `shared.invalid_permission_catalog`, with the repeated code in `data`, before the server accepts connections
7. IF a code does not start with the `<module>.` of the module that declares it, or does not follow the pattern, THEN building the catalog SHALL fail with `shared.invalid_permission_catalog`, with the code in `data`
8. WHEN a member without `identity.member.read` calls `GET /members` THEN the system SHALL answer `403 shared.permission_missing` with `data.required` equal to `"identity.member.read"`

**Independent test:** build the catalog with a repeated code and with a code without the prefix
and see both failures; call `GET /members` without the permission.

### S3: members can see the catalog (P2)

The front end and integrators find the codes they can grant.

**Acceptance Criteria**

9. WHEN an authenticated member calls `GET /permissions` THEN the system SHALL answer `200` with `permissions` equal to every code in the catalog, in alphabetical order
10. IF `GET /permissions` is called without a valid access token THEN the system SHALL answer `401`

**Independent test:** call `GET /permissions` with and without a token on a test catalog with two
modules.

### S4: codes outside the catalog block nothing and grant nothing (P2)

A code that left the catalog (like the old ones, without the prefix) is inert and can be removed.

**Acceptance Criteria**

11. IF a stored membership contains a code that is not in the catalog THEN loading it SHALL work, and the code SHALL appear in `membership.permissions` in `GET /members`
12. WHEN `PUT /members/:accountId/permissions` keeps a code outside the catalog that the membership already had THEN the system SHALL answer `200` with the code kept
13. WHEN `PUT /members/:accountId/permissions` removes a code outside the catalog THEN the system SHALL answer `200`, even when the actor does not hold that code
14. IF a membership has `invitation.create` (without the prefix) and does not have `identity.invitation.create` THEN `POST /invitations` SHALL answer `403 shared.permission_missing`

**Independent test:** store a membership with `invitation.create`, list members, keep it and
remove it through `PUT`, and try to invite with it.

## Out of scope

| Excluded                                                | Why                                                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Roles as a named set of permissions                     | another subject; the role stays a label (ADR-011)                                         |
| Granting a new module's permissions to admins at boot   | would turn the role into a rule; the path is running `grant-admin` again                  |
| A description or label for each permission from the API | the label belongs to the front end (i18n); the API returns only the codes                 |
| A migration script for the old codes                    | nobody uses the app yet (confirmed by the user)                                           |
| An example module (`orders`) in the code                | the tests use a test declaration; the boilerplate carries no module for cloners to delete |

## Assumptions

| Assumption                                            | Chosen default                                                       | Rationale                                                                   | Confirmed? |
| ----------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------- |
| Data stored with the old codes                        | no migration; they stay inert and the admin runs `grant-admin` again | nobody uses the app yet                                                     | y          |
| Label, in `web/`, of a code with no translation       | show the code itself                                                 | codes from modules the front end does not know stay visible and grantable   | n          |
| A pending invitation with an old code, accepted later | the membership gets the code as it is, and it stays inert            | same rule as door 5; not worth a special path                               | n          |
| RabbitMQ work still uncommitted in the working tree   | this change lands on top of it, also uncommitted                     | the user reviews everything first; they may prefer to commit RabbitMQ first | n          |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface                                                        | Decision                                | Landing                                                                                             |
| -------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| API `GET /permissions`                                         | response shape                          | AC 9                                                                                                |
| API `GET /permissions`                                         | error shape and codes                   | AC 10 (`401` from `authenticate`, in the existing RFC 9457 shape)                                   |
| API `GET /permissions`                                         | who may call it                         | AC 9, AC 10                                                                                         |
| API `GET /permissions`                                         | versioning                              | n/a - the API does not version routes; contract changes go to `docs/auth-front-end-contract.md`     |
| API `GET /permissions`                                         | rate limit                              | n/a - an authenticated read, like `GET /me`, which has no rate limit                                |
| API `POST /invitations`, `PUT /members/:accountId/permissions` | error shape and codes                   | AC 3, AC 4                                                                                          |
| API `POST /invitations`, `PUT /members/:accountId/permissions` | response shape and who may call it      | existing - unchanged beyond the accepted codes                                                      |
| API `POST /invitations`, `PUT /members/:accountId/permissions` | versioning and rate limit               | n/a - unchanged; these routes have no rate limit today                                              |
| command `pnpm identity:grant-admin`                            | output, exit codes, failing halfway     | existing - exit `1` and `identity.admin_grant_failed`; only the stored set changes (AC 5)           |
| `start` boot                                                   | what it prints when it fails            | AC 6, AC 7 (`shared.invalid_permission_catalog` through the existing boot-failure path)             |
| document readme and `docs/auth-front-end-contract.md`          | structure and what the reader does next | Impact (docs): the readme teaches how to declare a module's permissions and run `grant-admin` again |
| members and invitations pages (`web/`)                         | empty, loading and error states         | n/a - an example without tests; reuses the states the pages already have for the other calls        |

## Sources

- Conversation of 2026-11-02: the "permissions each module declares" proposal and the decision
  "prefix, no script; nobody uses the app yet"
- ADR-006 and ADR-011: `access` declared on the use case and the role as a label
- `readme.md`, sections "Making it yours" and "The first administrator"
