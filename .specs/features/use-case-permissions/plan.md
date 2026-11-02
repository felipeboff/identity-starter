# Use-case permissions

## Problem

Who may call an identity use case is written as code inside `execute`:
`this.deps.accessPolicy.ensureAdmin(actor)` or `ensureCanInvite(actor)` on the first line, and a
new use case is only protected if whoever writes it remembers the call and places it before any
read. Nothing in the use case states, as data, what it requires; an inventory of "who requires
what" has to read 19 `execute` bodies.

The rules read the role (`role`), not the permissions: `ensureAdmin` accepts only the `admin` role,
and the `admin` role also overrides `invite`, "grant only what you hold" and "act on someone else's
account". The `admin` permission can be granted, but no code reads it. The user decided that a role
is only a label (`admin`, `user`, `finance`...) and that access depends on permissions alone; today
the code does the opposite.

No external evidence beyond the code: no client consumes the errors yet.

When this ships: each use case declares `readonly permissions = [...]`, the `UseCase` base refuses
with `403 shared.permission_missing` before the body, the role no longer decides any access, and
the rules that depend on the input (account owner, grant only what you hold) stay in
`AccessPolicy`, reading permissions only. Each use case that requires a permission has its own
code; the generic `read`, `write`, `delete`, `admin` and `invite` are gone.

## Flow

Reuses the `UseCase` base, `AppError`/`defineError`, the `HttpErrorMapper` (`forbidden` → 403) and
`AccessPolicy` for the rules that depend on the input; no new checking point outside them.

1. protected route → `AuthenticateMiddleware` (exists) → `AuthenticateUseCase` (exists) builds the `Actor`, with `role` as a label no rule reads (door 5)
2. the handler (exists) calls `execute(input, actor)` → `UseCase` in `src/shared/application/use-cases.ts` (exists, door 1) compares the declared `permissions` with `actor.permissions` before the body and refuses with `SharedError.PermissionMissing` (door 2)
3. use-case body in `src/modules/identity/application/use-cases` (exists) - the rules that depend on the input go through `AccessPolicy` (exists), which reads permissions only
4. out: the use case's result, or the `AppError` goes up to the `HttpErrorMapper` (exists) and leaves as `403` problem details

## Impact

| Front          | What changes                                                                                                                                                                                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| domain         | existing term: `role` - meant "admin overrides everything", now only a label with no effect on access. Who branches on it today: `AccessPolicy.ensureAdmin`, `ensureCanInvite`, `ensureCanGrant` and `ensureCanManageAccount` (all change here)                                                                   |
| domain         | existing term: `MembershipPermission` - five generic codes (`read`, `write`, `delete`, `admin`, `invite`) become nine, one per use case that requires a permission (door 6). Who branches on it: `Membership` and `Invitation` validation, the persistence schema enum, the handlers' input enums, `AccessPolicy` |
| shared kernel  | `UseCase` gains `readonly permissions` and `readonly anyPermissions` and wraps `execute` in its constructor; `SharedError` gains `PermissionMissing`                                                                                                                                                              |
| `Actor`        | keeps `role`, now only a label: no access rule reads it; today only `AccessPolicy` reads `actor.role`, and it stops (door 5)                                                                                                                                                                                      |
| error contract | a refusal by declared permission answers `shared.permission_missing` instead of `identity.forbidden` (the 403 status does not change). Readers: `docs/auth-front-end-contract.md`; `web/` does not use the code                                                                                                   |
| stored data    | memberships and invitations stored with an old generic code fail validation when loaded; nothing to migrate - there is no published environment                                                                                                                                                                   |
| docs           | `docs/auth-front-end-contract.md` and `NEXT-STEPS.md` (lines about invitations) speak of permissions; ADR-006 records the pattern (through `create-adr`)                                                                                                                                                          |

## Relations

`None - no stored-data shape change`

## Surface

`None - nothing consumed outside`: no new route and no changed signature; every affected route
already declares `403` in `failures`. The error-code change is in `Impact`.

## Landing

| One-way door                                                                | Literal shape                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Alternative rejected                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Permission declared on the use case (pattern)                            | `readonly permissions = [MembershipPermission.INVITE];` on the class; typed by the shape itself, with no module import in `shared`: `type ResolvePermissions<S> = S extends { actor: { permissions: readonly (infer P)[] } } ? readonly P[] : never`; the base wraps `execute` in its constructor and reads `this.permissions` at call time, against the last argument; besides `permissions` (requires every code), `readonly anyPermissions = [MembershipPermission.READ, MembershipPermission.WRITE];` (requires at least one), with the same `ResolvePermissions<S>` type; with both declared both apply, and `permissions` is checked first; absent or `[]` requires nothing | `this.deps.accessPolicy.ensureX(actor)` in the body (the status quo) - the requirement is not data and its position is up to whoever writes it; a `permission` field on the `HttpRoute` - a direct `execute` call bypasses it; importing `MembershipPermission` in `shared` - breaks the ESLint rule "shared never imports a module"; a single prop with a mode (`{ all: [...] }` / `{ any: [...] }`) - cannot express "all of these and one of those" at once |
| 2. Refusal code (error contract)                                            | `SharedError.PermissionMissing = defineError<{ required: string } \| { anyOf: readonly string[] }>("shared.permission_missing", "forbidden")`; missing from `permissions` → `{ required: <first missing code, in declared order> }`; none of `anyPermissions` → `{ anyOf: <the declared list> }`                                                                                                                                                                                                                                                                                                                                                                                  | keeping `identity.forbidden` - the base lives in `shared` and cannot import identity errors (forced by the module boundary); a separate code for "at least one" - the front end would handle two codes for the same situation, a missing permission                                                                                                                                                                                                            |
| 3. Access reads permissions only                                            | `Actor = { accountId, sessionId, membershipId, permissions }`, without `role`; `AccessPolicy` keeps `ensureCanManageAccount` (owner or `admin` permission) and `ensureCanGrant` (only what you hold, unless you hold `admin`); `ensureAdmin` and `ensureCanInvite` cease to exist                                                                                                                                                                                                                                                                                                                                                                                                 | the `admin` role as a preset of every permission (the linkio model) - the user decided that a role carries no access meaning                                                                                                                                                                                                                                                                                                                                   |
| 4. Actor used only by the declared check (found mid-build)                  | the parameter is named `_actor`; `eslint.config.ts` sets `"@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | dropping the parameter from the subclass `execute` - narrows the instance signature, so the handler's `execute(input, actor)` stops compiling; an `eslint-disable` line per use case - comment noise on every such use case                                                                                                                                                                                                                                    |
| 5. `role` stays on the `Actor` as a label (replaces door 3's `Actor` shape) | `Actor = { accountId, sessionId, membershipId, role, permissions }`; `AccessPolicy` and the `UseCase` base read `permissions` only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | removing `role` from `Actor` (door 3) - the compiler would forbid reading the role, but the user wants the label available to whoever receives the `Actor`                                                                                                                                                                                                                                                                                                     |
| 6. One code per use case (replaces door 3's policy rules)                   | `MembershipPermission = { INVITATION_CREATE: "invitation.create", INVITATION_READ: "invitation.read", INVITATION_REVOKE: "invitation.revoke", ACCOUNT_REACTIVATE: "account.reactivate", ACCOUNT_DEACTIVATE: "account.deactivate", SESSION_REVOKE: "session.revoke", SESSION_REVOKE_ALL: "session.revoke_all", MEMBER_ROLE_UPDATE: "member.role.update", MEMBER_PERMISSIONS_UPDATE: "member.permissions.update" }`; `ensureCanManageAccount(actor, accountId, permission)` lets the owner or a holder of that use case's code through; `ensureCanGrant` refuses any code the inviter does not hold, with no exception                                                              | the generic codes (`admin`, `invite`...) - one code opens several unrelated operations; a code for the self-service use cases (`/me/*`, sign-out) too - sign-up creates a membership with no permissions, so every new account would lose its own profile; a holder of `member.permissions.update` granting anything in an invitation - the user chose no exception                                                                                            |

- Nothing else in this change is hard to reverse

## Criteria

### S1: The `UseCase` base refuses before the body (P1)

A use case that declares `permissions` runs only for whoever holds every code.

**Acceptance Criteria**

1. WHEN a use case declares `permissions` and the actor holds every code THEN the system SHALL run the body of `execute` and return its result
2. IF the actor lacks any code of `permissions` THEN the system SHALL throw `shared.permission_missing` (kind `forbidden`) with `data.required` equal to the first missing code, in declared order
3. IF the refusal of criterion 2 happens THEN the system SHALL NOT run the body of `execute` (no repository read or write)
4. WHEN a use case does not declare `permissions`, or declares `[]`, THEN the system SHALL run the body for any actor, including one with no permissions
5. The system SHALL reject at compile time `permissions` on a use case whose shape has no `actor`, and a code outside the actor's permission type

Added mid-build with `anyPermissions`:

18. WHEN a use case declares `anyPermissions` and the actor holds at least one of the codes THEN the system SHALL run the body of `execute` and return its result
19. IF the actor holds none of the codes of `anyPermissions` THEN the system SHALL throw `shared.permission_missing` (kind `forbidden`) with `data.anyOf` equal to the declared list, without running the body
20. WHEN a use case declares `permissions` and `anyPermissions` THEN the system SHALL require every code of `permissions` and at least one of `anyPermissions`, refusing first for what is missing from `permissions` (`data.required`)
21. WHEN a use case does not declare `anyPermissions`, or declares `[]`, THEN the system SHALL run the body without requiring any code of that list
22. The system SHALL reject at compile time `anyPermissions` on a use case whose shape has no `actor`, and a code outside the actor's permission type

**Independent test:** a test use case with `permissions = [WRITE, READ]` runs for an actor holding both and refuses `{ required: "read" }` for an actor holding only `write`, without touching the fake repository.

### S2: Each invitation operation requires its own permission, not the role (P1)

Inviting, listing and revoking invitations each depend on their own code; granting depends on what the inviter holds.

**Acceptance Criteria**

6. IF a member lacks the operation's code - `invitation.create` to invite, `invitation.read` to list, `invitation.revoke` to revoke - THEN the system SHALL answer `403 shared.permission_missing` with `data.required` equal to that code, also when their role is `admin` and they hold every other code
7. WHEN a member with the `user` role and `invitation.read` lists invitations THEN the system SHALL answer `200` with the pending invitations
8. IF the inviter asks in the invitation for a permission they do not hold THEN the system SHALL answer `403 identity.forbidden`
9. WHEN the inviter holds `invitation.create` and asks for the `admin` role with permissions they hold THEN the system SHALL create the invitation (`201`)
10. IF the inviter holds every code but one they ask for, `member.permissions.update` included, THEN the system SHALL answer `403 identity.forbidden` - no code lets anyone grant what they do not hold

**Independent test:** a member with the `admin` role holding every code but `invitation.read` gets `403 shared.permission_missing` on `GET /invitations`; one with the `user` role holding `invitation.read` gets `200`.

### S3: Each administration action requires its own permission (P1)

Reactivating, changing a role, changing permissions and acting on someone else's account each depend on their own code.

**Acceptance Criteria**

11. IF a member lacks the operation's code - `account.reactivate` to reactivate an account, `member.role.update` to change a role, `member.permissions.update` to change permissions - THEN the system SHALL answer `403 shared.permission_missing` with `data.required` equal to that code, also when their role is `admin` and they hold every other code
12. WHEN a member with the `user` role and `account.reactivate` reactivates an account THEN the system SHALL reactivate it (`200`)
13. IF a member lacks the operation's code - `account.deactivate`, `session.revoke`, `session.revoke_all` - and deactivates someone else's account, revokes someone else's session or revokes all of someone else's sessions THEN the system SHALL answer `403 identity.forbidden`
14. WHEN a member with the `user` role and `account.deactivate` deactivates someone else's account THEN the system SHALL deactivate it (`204`)
15. IF a member changes their own permissions THEN the system SHALL answer `403 identity.forbidden`, so that nobody removes their own `member.permissions.update`

**Independent test:** a member with the `admin` role holding every code but `account.reactivate` gets `403 shared.permission_missing` on `POST /accounts/:accountId/reactivate`; one with the `user` role holding `account.reactivate` gets `200`.

### S4: The role does not decide access (P1)

The `Actor` carries the role as a label; no access rule reads it.

**Acceptance Criteria**

16. The system SHALL build the `Actor` with `accountId`, `sessionId`, `membershipId`, `role` (the membership's role) and `permissions`, and no other key

**Independent test:** `AuthenticateUseCase` returns exactly those five fields; that the role grants nothing is proven by criteria 6, 11 and 13 (an `admin` role without the code is refused).

### S5: The front-end contract describes the permissions (P2)

Whoever integrates the front end knows which permission each action requires and which error to expect.

**Acceptance Criteria**

17. The document `docs/auth-front-end-contract.md` SHALL list each of the nine codes with the route it opens, and state that a refusal by declared permission is `403 shared.permission_missing` with `data.required`

**Independent test:** read the invitations section and the members section of the document.

## Out of scope

| Excluded                                                 | Why                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Reach by organization (`OrgAccess`, linkio's layer 2)    | identity-starter has a single organization                                                                    |
| Creating the first admin (bootstrap)                     | does not exist today; sign-up creates the `user` role with no permissions, and that stays                     |
| Role as a preset of permissions                          | the user decided that a role is only a label                                                                  |
| Codes for the self-service use cases (`/me/*`, sign-out) | sign-up creates a membership with no permissions; the user chose only the nine use cases that already checked |

## Assumptions

| Assumption                                               | Chosen default                                       | Rationale                                                                                                                               | Confirmed? |
| -------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Existing memberships with the `admin` role or old codes  | nothing to migrate                                   | there is no published environment; in the development database, whoever needs powers gets the new codes by hand                         | n          |
| `update-member-role` guard (cannot change your own role) | stays as it is                                       | the role no longer grants access, so the guard lost its reason, but removing it is another change                                       | n          |
| Error of the rules that depend on the input              | stays `identity.forbidden` with `{ actorAccountId }` | only the declared check lives in `shared`; account owner, grant only what you hold and changing your own permissions are identity rules | n          |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface                                                                                                           | Decision                             | Landing                                                          |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------- |
| API `POST /invitations`, `GET /invitations`, `DELETE /invitations/:invitationId`                                  | error shape and codes                | AC 6, 8                                                          |
| API `POST /accounts/:accountId/reactivate`, `PUT /members/:accountId/role`, `PUT /members/:accountId/permissions` | error shape and codes                | AC 11, 15                                                        |
| API `POST /accounts/:accountId/deactivate`, `DELETE /sessions/:sessionId`, `DELETE /accounts/:accountId/sessions` | who may call it                      | AC 13, 14                                                        |
| all routes above                                                                                                  | response shape                       | existing - the success body does not change                      |
| all routes above                                                                                                  | versioning, rate limit               | n/a - no signature changes, and these routes have no limit today |
| document `docs/auth-front-end-contract.md`                                                                        | structure, what the reader does next | AC 17                                                            |

## Sources

- linkio `docs/adr/010-use-case-declared-permissions.md` - the pattern of declared permissions checked by the `UseCase` base
- the user's decision in this conversation (2026-10-30): "the role means nothing, whether admin, user or finance, what matters is permissions"
- the user's decision in this conversation (2026-10-30): one specific permission per use case, the generic ones removed; nobody grants what they do not hold
