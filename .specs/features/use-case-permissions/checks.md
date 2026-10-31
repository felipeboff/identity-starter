# Use-case permissions checks

Profile: light
Plan: `.specs/features/use-case-permissions/plan.md`

33 checks in 5 slices · 6 one-way doors · 0 open, of which 0 block

## Checks

Grouped by the plan's slices; numbering runs across the whole feature.

### S1 - The `UseCase` base refuses before the body · 3 files · 3 KB · ~1k

**C1** - A use case declaring `permissions` runs its body and returns its result for an actor holding every code (AC 1)
Proof: `pnpm exec vitest run src/shared/application/use-cases.spec.ts -t "runs the body for an actor holding every declared permission"`

**C2** - An actor missing a declared code gets `shared.permission_missing` (kind `forbidden`) with `data.required` equal to the first missing code in declared order (AC 2)
Proof: `pnpm exec vitest run src/shared/application/use-cases.spec.ts -t "refuses with permission_missing naming the first missing code in declared order"`

**C3** - On that refusal the body never runs: the fake repository sees no read and no write (AC 3)
Proof: `pnpm exec vitest run src/shared/application/use-cases.spec.ts -t "does not run the body when it refuses"`

**C4** - With `permissions` undeclared or `[]`, the body runs for an actor with no permissions (AC 4)
Proof: `pnpm exec vitest run src/shared/application/use-cases.spec.ts -t "runs the body for any actor when nothing is required"`

**C5** - `permissions` on a shape with no `actor`, and a code outside the actor's permission type, are compile errors (AC 5)
Proof: `pnpm typecheck`
Proof: `pnpm exec vitest run src/shared/application/use-cases.spec.ts -t "rejects permissions the shape cannot hold at compile time"`

**C28** - A use case declaring `anyPermissions` runs its body and returns its result for an actor holding only one of the codes (AC 18)
Proof: `pnpm exec vitest run src/shared/application/use-cases.spec.ts -t "runs the body for an actor holding one of anyPermissions"`

**C29** - An actor holding none of `anyPermissions` gets `shared.permission_missing` (kind `forbidden`) with `data.anyOf` equal to the declared list, and the body never runs (AC 19)
Proof: `pnpm exec vitest run src/shared/application/use-cases.spec.ts -t "refuses with permission_missing listing anyOf when the actor holds none"`

**C30** - With both lists declared, an actor missing a `permissions` code is refused with `data.required` even when holding none of `anyPermissions`, and an actor holding every `permissions` code but none of `anyPermissions` is refused with `data.anyOf` (AC 20)
Proof: `pnpm exec vitest run src/shared/application/use-cases.spec.ts -t "requires every permission and one of anyPermissions, checking permissions first"`

**C31** - With `anyPermissions` undeclared or `[]`, the body runs for an actor with no permissions (AC 21)
Proof: `pnpm exec vitest run src/shared/application/use-cases.spec.ts -t "runs the body for any actor when nothing is required"`

**C32** - `anyPermissions` on a shape with no `actor`, and a code outside the actor's permission type, are compile errors (AC 22)
Proof: `pnpm typecheck`
Proof: `pnpm exec vitest run src/shared/application/use-cases.spec.ts -t "rejects anyPermissions the shape cannot hold at compile time"`

**C33** - A use case whose only use of the actor is the declared check names it `_actor` and passes lint (Landing door 4)
Proof: `pnpm exec eslint src/modules/identity/application/use-cases/list-invitations.use-case.ts src/modules/identity/application/use-cases/revoke-invitation.use-case.ts src/modules/identity/application/use-cases/reactivate-account.use-case.ts`

### S2 - Each invitation operation requires its own permission, not the role · 12 files · 45 KB · ~11k

**C6** - `ListInvitationsUseCase` refuses an `admin`-role actor holding every code but `invitation.read` with `shared.permission_missing`, `data.required = "invitation.read"` (AC 6)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/list-invitations.use-case.spec.ts -t "refuses permission_missing without invitation.read, even with the admin role"`

**C7** - `InviteMemberUseCase` refuses an `admin`-role actor holding every code but `invitation.create` with `shared.permission_missing`, `data.required = "invitation.create"` (AC 6)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/invite-member.use-case.spec.ts -t "refuses permission_missing without invitation.create, even with the admin role"`

**C8** - `RevokeInvitationUseCase` refuses an `admin`-role actor holding every code but `invitation.revoke` with `shared.permission_missing`, `data.required = "invitation.revoke"` (AC 6)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/revoke-invitation.use-case.spec.ts -t "refuses permission_missing without invitation.revoke, even with the admin role"`

**C9** - Over HTTP, `POST /invitations`, `GET /invitations` and `DELETE /invitations/:invitationId` answer `403` with `code: "shared.permission_missing"` and `data.required` equal to the route's code (`invitation.create`, `invitation.read`, `invitation.revoke`) to an `admin`-role member holding every other code (AC 6)
Proof: `pnpm exec vitest run src/modules/identity/presentation/invitations.e2e.spec.ts -t "answers 403 permission_missing without the route's permission, even with the admin role"`

**C10** - A `user`-role member holding `invitation.read` gets `200` with the pending invitations on `GET /invitations` (AC 7)
Proof: `pnpm exec vitest run src/modules/identity/presentation/invitations.e2e.spec.ts -t "lists the pending invitations to a user-role member holding invitation.read"`

**C11** - An inviter asking for a permission they do not hold gets `403 identity.forbidden` (AC 8)
Proof: `pnpm exec vitest run src/modules/identity/application/policies/access.policy.spec.ts -t "refuses a grant beyond the actor's own permissions, whatever they hold"`
Proof: `pnpm exec vitest run src/modules/identity/presentation/invitations.e2e.spec.ts -t "answers 403 forbidden when the inviter grants a permission they do not have"`

**C12** - An inviter holding `invitation.create` asking for the `admin` role with permissions they hold gets the invitation created (`201`) (AC 9)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/invite-member.use-case.spec.ts -t "invites with the admin role within the inviter's own permissions"`
Proof: `pnpm exec vitest run src/modules/identity/presentation/invitations.e2e.spec.ts -t "lets an inviter give the admin role with permissions they hold"`

**C13** - An inviter holding every code but one they ask for, `member.permissions.update` or any other, gets `403 identity.forbidden` and no invitation is sent (AC 10)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/invite-member.use-case.spec.ts -t "throws Forbidden when the inviter lacks one asked permission, whatever else they hold"`
Proof: `pnpm exec vitest run src/modules/identity/presentation/invitations.e2e.spec.ts -t "answers 403 forbidden when the inviter lacks one asked permission, whatever else they hold"`

### S3 - Each administration action requires its own permission · 22 files · 75 KB · ~19k

**C14** - `ReactivateAccountUseCase` refuses an `admin`-role actor holding every code but `account.reactivate` with `shared.permission_missing`, `data.required = "account.reactivate"` (AC 11)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/reactivate-account.use-case.spec.ts -t "refuses permission_missing without account.reactivate, even with the admin role"`

**C15** - `UpdateMemberRoleUseCase` refuses an `admin`-role actor holding every code but `member.role.update` with `shared.permission_missing`, `data.required = "member.role.update"` (AC 11)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/update-member-role.use-case.spec.ts -t "refuses permission_missing without member.role.update, even with the admin role"`

**C16** - `UpdateMemberPermissionsUseCase` refuses an `admin`-role actor holding every code but `member.permissions.update` with `shared.permission_missing`, `data.required = "member.permissions.update"` (AC 11)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/update-member-permissions.use-case.spec.ts -t "refuses permission_missing without member.permissions.update, even with the admin role"`

**C17** - Over HTTP, `POST /accounts/:accountId/reactivate`, `PUT /members/:accountId/role` and `PUT /members/:accountId/permissions` answer `403` with `code: "shared.permission_missing"` and `data.required` equal to the route's code (`account.reactivate`, `member.role.update`, `member.permissions.update`) to an `admin`-role member holding every other code (AC 11)
Proof: `pnpm exec vitest run src/modules/identity/presentation/identity.failures.e2e.spec.ts -t "answers 403 permission_missing without the route's permission, even with the admin role"`

**C18** - A `user`-role member holding `account.reactivate` reactivates an account: `200` and the account is active again (AC 12)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/reactivate-account.use-case.spec.ts -t "reactivates for a user-role member holding account.reactivate"`
Proof: `pnpm exec vitest run src/modules/identity/presentation/me.routes.e2e.spec.ts -t "reactivates an account with 200"`

**C19** - `DeactivateAccountUseCase` refuses an `admin`-role actor holding every code but `account.deactivate` on someone else's account with `identity.forbidden` (AC 13)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/deactivate-account.use-case.spec.ts -t "throws Forbidden on someone else's account without account.deactivate, even with the admin role"`

**C20** - `RevokeSessionUseCase` refuses an `admin`-role actor holding every code but `session.revoke` on someone else's session with `identity.forbidden` (AC 13)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/revoke-session.use-case.spec.ts -t "throws Forbidden on someone else's session without session.revoke, even with the admin role"`

**C21** - `RevokeAllSessionsUseCase` refuses an `admin`-role actor holding every code but `session.revoke_all` on someone else's account with `identity.forbidden` (AC 13)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/revoke-all-sessions.use-case.spec.ts -t "throws Forbidden on someone else's account without session.revoke_all, even with the admin role"`

**C22** - `AccessPolicy.ensureCanManageAccount` lets the owner and a holder of the given code through and refuses anyone else with `identity.forbidden`, even with the `admin` role and every other code (AC 13, 14)
Proof: `pnpm exec vitest run src/modules/identity/application/policies/access.policy.spec.ts -t "ensureCanManageAccount"`

**C23** - Over HTTP, a `user`-role member holding `account.deactivate` deactivates someone else's account with `204` (AC 14)
Proof: `pnpm exec vitest run src/modules/identity/presentation/me.routes.e2e.spec.ts -t "deactivates an account with 204"`

**C24** - A member changing their own permissions gets `403 identity.forbidden` and the membership keeps its permissions (AC 15)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/update-member-permissions.use-case.spec.ts -t "throws Forbidden when the actor changes their own permissions"`
Proof: `pnpm exec vitest run src/modules/identity/presentation/identity.failures.e2e.spec.ts -t "answers 403 forbidden to a member changing their own permissions"`

### S4 - The role does not decide access · 2 files · 5 KB · ~1k

**C25** - `AuthenticateUseCase` returns exactly `{ accountId, sessionId, membershipId, role, permissions }` with the membership's role, and `Actor` has no other key (AC 16)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/authenticate.use-case.spec.ts -t "returns the actor with its ids, role and permissions"`
Proof: `pnpm typecheck`

### S5 - The front-end contract describes the permissions · 2 files · 12 KB · ~3k

**C26** - `docs/auth-front-end-contract.md` lists each of the nine codes in a table row with the route it opens (AC 17)
Proof: `test "$(grep -cE '^\| .(invitation\.(create|read|revoke)|account\.(reactivate|deactivate)|session\.(revoke|revoke_all)|member\.(role|permissions)\.update). +\| .(POST|GET|DELETE|PUT) /' docs/auth-front-end-contract.md)" -eq 9`

**C27** - `docs/auth-front-end-contract.md` states that a refusal by declared permission is `403 shared.permission_missing` with `data.required` (AC 17)
Proof: `grep -E ".403 shared\.permission_missing. with .data\.required." docs/auth-front-end-contract.md`

## Coverage

| Set (size)                                       | Member -> proof                                                                                                                                                        | Unproven |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `Landing` doors (6)                              | declared permission C1, C28 · refusal code C2, C29 · access reads permissions only C9, C17, C22 · `_actor` C33 · `role` on the `Actor` C25 · one code per use case C26 | -        |
| `permissions` states (3)                         | all held C1 · one missing C2 · undeclared or empty C4                                                                                                                  | -        |
| `anyPermissions` states (4)                      | one held C28 · none held C29 · combined with `permissions` C30 · undeclared or empty C31                                                                               | -        |
| invitation use cases, each with its code (3)     | list C6 · invite C7 · revoke C8                                                                                                                                        | -        |
| invitation routes, refusal at the edge (3)       | C9, table-driven over all 3                                                                                                                                            | -        |
| administration use cases, each with its code (3) | reactivate C14 · change role C15 · change permissions C16                                                                                                              | -        |
| administration routes, refusal at the edge (3)   | C17, table-driven over all 3                                                                                                                                           | -        |
| use cases acting on someone else's account (3)   | deactivate C19 · revoke session C20 · revoke all sessions C21                                                                                                          | -        |
| `ensureCanManageAccount` outcomes (3)            | owner C22 · holder of the code C22 · anyone else C22                                                                                                                   | -        |
| `ensureCanGrant` outcomes (3)                    | within own, any role C12 · beyond own C11 · beyond own while holding every other code C13                                                                              | -        |
| `docs/auth-front-end-contract.md` statements (2) | nine codes with routes C26 · refusal code C27                                                                                                                          | -        |

- Claims naming a status code or response shape: C9, C10, C11, C12, C13, C17, C18, C23, C24 - each has a proof that
  crosses the HTTP edge
- No other check claims more than the single case its proof exercises

## Swept

- validation: n/a - no new input; the permission codes come from the stored membership, already validated by `Membership`
- failure modes: C3
- idempotency: n/a - the check only reads the actor; nothing is written on a refusal
- authorization: C1-C33
- concurrency: n/a - the actor is built per request by `AuthenticateUseCase`, so a permission change applies from the next request, as today
- data lifecycle: n/a - no stored-data shape change
- dependency failure: n/a - no external dependency is touched
- state transitions: C24
- observability: n/a - a refusal is an `AppError` logged by the `HttpErrorMapper` like any other; no new log requirement

## Handoff

- S1-S5 = 155 KB across 41 files (`wc -c`, /4) ≈ 39k, under the 150k budget - one builder
- **Boundary:** C1-C33 closed (uncommitted, awaiting the user's review)
- **Settled mid-build:** C12's first proof moved from `access.policy.spec.ts` to `invite-member.use-case.spec.ts` before any test existed for it - without `role`, `ensureCanGrant` never sees the role, so a policy test could not reach "any role"; the claim is unchanged. Landing door 4 (`_actor`) appended to the plan before the ESLint change; the orphaned `eslint-disable` in `express-adapter.ts` removed. C26/C27 proofs match each backtick with `.` (`grep -E`), because an escaped backtick breaks the markdown code span and prettier merged C27's two proof lines; same phrases. Mid-build the user asked for `anyPermissions` (plan change approved: AC 18-22, C28-C32)
- **Settled after verification round 2:** the user asked to keep `role` on the `Actor` as a label (door 5, AC 16, C25) and to replace the generic codes with one per use case, nobody granting what they do not hold (door 6, AC 6-15 and 17 reworded, C6-C24 and C26-C27 re-pointed to the new tests)
- **Abandoned:** binding `execute` in the constructor (as linkio does) - the e2e specs spy on `UseCase.prototype.execute` after the module builds its instances, so a bound copy would never reach the spy and their "not called" assertions would pass vacuously; the base looks the method up on the prototype at call time instead
