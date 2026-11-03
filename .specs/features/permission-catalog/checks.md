# Permission catalog checks

Profile: light
Plan: `.specs/features/permission-catalog/plan.md`

22 checks in 4 slices · 5 one-way doors · 0 open, of which 0 block

## Checks

Grouped by the plan's slices; numbering runs across the whole feature.

### S1 - A module declares permissions and identity accepts them

**C1** - `POST /invitations` by a member holding `identity.invitation.create` and a code another module declares, asking for that code, answers `201` with `invitation.permissions` equal to `[code]` (AC 1)
Proof: `pnpm exec vitest run src/modules/identity/presentation/invitations.e2e.spec.ts -t "invites with a permission another module declares"`
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/invite-member.use-case.spec.ts -t "grants a permission another module declares"`

**C2** - `PUT /members/:accountId/permissions` by a member holding `identity.member.permissions.update` and a code another module declares, adding that code, answers `200` with the code in `membership.permissions` (AC 2)
Proof: `pnpm exec vitest run src/modules/identity/presentation/permissions.e2e.spec.ts -t "adds a permission another module declares"`
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/update-member-permissions.use-case.spec.ts -t "adds a permission another module declares"`

**C3** - An added code in the pattern but outside the catalog is refused with `400 identity.invalid_membership_permissions`, `data.permissions` equal to the unknown codes only, before the check of what the actor holds, on both routes (AC 3, door 5)
Proof: `pnpm exec vitest run src/modules/identity/application/policies/access.policy.spec.ts -t "refuses a code outside the catalog before what the actor holds"`
Proof: `pnpm exec vitest run src/modules/identity/presentation/invitations.e2e.spec.ts -t "answers 400 for a permission outside the catalog"`
Proof: `pnpm exec vitest run src/modules/identity/presentation/permissions.e2e.spec.ts -t "answers 400 for an added permission outside the catalog"`

**C4** - A code with an uppercase letter, with a single segment, with an empty segment, or longer than 100 characters answers `400 shared.input_invalid` on both routes (AC 4, door 3)
Proof: `pnpm exec vitest run src/modules/identity/presentation/permissions.e2e.spec.ts -t "answers 400 input_invalid for a permission outside the pattern"`

**C5** - `GrantAdminUseCase` leaves the membership with the `admin` role and exactly `catalog.all()`, another module's codes included (AC 5)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/grant-admin.use-case.spec.ts -t "grants exactly every code in the catalog"`

### S2 - The catalog is checked at boot and identity uses the prefix

**C6** - Building a `PermissionCatalog` with a code declared twice throws `shared.invalid_permission_catalog` with that code in `data` (AC 6, door 1)
Proof: `pnpm exec vitest run src/shared/domain/value-objects/permission-catalog.value-object.spec.ts -t "refuses a code declared twice"`

**C7** - Building a `PermissionCatalog` with a code outside its module's `<module>.` prefix, or outside the pattern, throws `shared.invalid_permission_catalog` with that code in `data` (AC 7, door 1, door 3)
Proof: `pnpm exec vitest run src/shared/domain/value-objects/permission-catalog.value-object.spec.ts -t "refuses a code outside its module's prefix"`
Proof: `pnpm exec vitest run src/shared/domain/value-objects/permission-catalog.value-object.spec.ts -t "refuses a code outside the pattern"`

**C8** - `GET /members` by a member without `identity.member.read` answers `403 shared.permission_missing` with `data.required` = `identity.member.read` (AC 8)
Proof: `pnpm exec vitest run src/modules/identity/presentation/identity.failures.e2e.spec.ts -t "answers 403 permission_missing without the route's permission"`

**C9** - `IdentityPermission` holds exactly the 11 codes `identity.invitation.create`, `identity.invitation.read`, `identity.invitation.revoke`, `identity.account.reactivate`, `identity.account.deactivate`, `identity.session.read`, `identity.session.revoke`, `identity.session.revoke_all`, `identity.member.read`, `identity.member.role.update`, `identity.member.permissions.update` (door 3)
Proof: `pnpm exec vitest run src/modules/identity/domain/identity.permission.spec.ts -t "names identity's eleven codes with the identity prefix"`

**C10** - `identityPermissions` declares the module `identity` with every `IdentityPermission` code (door 2)
Proof: `pnpm exec vitest run src/modules/identity/identity.module.integration.spec.ts -t "declares identity's permissions"`

**C11** - The running app answers `GET /permissions` with identity's 11 codes, so `start` hands the app's catalog to identity (door 1)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "lists identity's permissions"`

### S3 - Members can see the catalog

**C12** - `GET /permissions` by an authenticated member answers `200` with `permissions` equal to identity's codes and another module's codes, together, in alphabetical order (AC 9, door 4)
Proof: `pnpm exec vitest run src/modules/identity/presentation/permissions.e2e.spec.ts -t "lists every permission in the catalog in alphabetical order"`
Proof: `pnpm exec vitest run src/shared/domain/value-objects/permission-catalog.value-object.spec.ts -t "lists every code in alphabetical order"`

**C13** - `GET /permissions` without a valid access token answers `401` (AC 10)
Proof: `pnpm exec vitest run src/modules/identity/presentation/permissions.e2e.spec.ts -t "answers 401 without a valid access token"`

**C14** - `GET /permissions` is a protected identity route next to the others, and identity declares 32 routes (door 4)
Proof: `pnpm exec vitest run src/modules/identity/presentation/identity.routes.e2e.spec.ts -t "declares the 32 routes"`

### S4 - Codes outside the catalog block nothing and grant nothing

**C15** - A membership and an invitation holding a code outside any catalog register, restore and keep it in their snapshot (AC 11, door 5)
Proof: `pnpm exec vitest run src/modules/identity/domain/membership.entity.spec.ts src/modules/identity/domain/invitation.entity.spec.ts -t "keeps a code outside any catalog"`

**C16** - Every membership and invitation repository saves and restores a code outside the catalog, in memory and in Mongo (AC 11, door 5)
Proof: `pnpm exec vitest run src/modules/identity/infrastructure/persistence/mongo-membership.repository.integration.spec.ts src/modules/identity/infrastructure/persistence/mongo-invitation.repository.integration.spec.ts src/modules/identity/application/testing/in-memory-identity-repositories.spec.ts -t "keeps a permission code outside the catalog"`

**C17** - `GET /members` lists a member's code that is outside the catalog in `membership.permissions` (AC 11)
Proof: `pnpm exec vitest run src/modules/identity/presentation/permissions.e2e.spec.ts -t "lists a member's code that left the catalog"`

**C18** - `PUT /members/:accountId/permissions` keeping a code outside the catalog that the member already had answers `200` with the code kept (AC 12, door 5)
Proof: `pnpm exec vitest run src/modules/identity/presentation/permissions.e2e.spec.ts -t "keeps a code that left the catalog"`
Proof: `pnpm exec vitest run src/modules/identity/application/policies/access.policy.spec.ts -t "lets a code outside the catalog stay"`

**C19** - `PUT /members/:accountId/permissions` removing a code outside the catalog that the actor does not hold answers `200` without the code (AC 13, door 5)
Proof: `pnpm exec vitest run src/modules/identity/presentation/permissions.e2e.spec.ts -t "removes a code that left the catalog"`
Proof: `pnpm exec vitest run src/modules/identity/application/policies/access.policy.spec.ts -t "lets the actor remove a code outside the catalog they do not hold"`

**C20** - A member holding the old `invitation.create` and not `identity.invitation.create` gets `403 shared.permission_missing` on `POST /invitations` (AC 14)
Proof: `pnpm exec vitest run src/modules/identity/presentation/invitations.e2e.spec.ts -t "answers 403 to a member holding only the unprefixed code"`

**C21** - Accepting an invitation copies its permissions into the new membership as they are, a code outside the catalog included (plan assumption)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/accept-invitation.use-case.spec.ts -t "copies a code outside the catalog as it is"`

**C22** - Every declared status of `GET /permissions`, `POST /invitations` and `PUT /members/:accountId/permissions` is received by an e2e test, and no undeclared one is (strict route-status matrix)
Proof: `pnpm test:e2e:coverage`

## Coverage

| Set (size)                                         | Member -> proof                                                                            | Unproven |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------- |
| `GET /permissions` statuses (2)                    | 200 C12 · 401 C13                                                                          | -        |
| `POST /invitations` statuses (5)                   | 201 C1 · 400 C3, C4 · 401 C22 · 403 C20 · 422 C22                                          | -        |
| `PUT /members/:accountId/permissions` statuses (6) | 200 C2, C18, C19 · 400 C3, C4 · 401 C22 · 403 C8, C22 · 404 C22 · 422 C22                  | -        |
| refused code formats (4)                           | uppercase C4 · single segment C4 · empty segment C4 · over 100 characters C4               | -        |
| catalog construction failures (3)                  | repeated code C6 · outside the module prefix C7 · outside the pattern C7                   | -        |
| what a permissions change does with a code (4)     | added and known C2 · added and unknown C3 · kept and unknown C18 · removed and unknown C19 | -        |
| ways a code reaches a membership (3)               | permissions change C2 · `grant-admin` C5 · accepted invitation C21                         | -        |
| stored-code holders (4)                            | membership entity C15 · invitation entity C15 · in-memory C16 · Mongo C16                  | -        |
| startup config: catalog (1 shared assembly)        | `src/app` catalog used by `start` C11 and by `scripts/grant-admin.ts`                      | -        |
| Landing doors (5)                                  | 1 C6, C7, C11 · 2 C10 · 3 C4, C7, C9 · 4 C12, C13, C14 · 5 C3, C15, C16, C18, C19          | -        |

- Claims naming a status code, error code or response shape: C1, C2, C3, C4, C8, C12, C13, C17, C18, C19, C20 - each has a proof that crosses the HTTP boundary
- C22 is the one proof that is a whole run: the route-status matrix is only checked by the strict e2e coverage run
- No other check claims more than the single case its proof exercises

## Swept

- validation: C4 (code format at the edge), C6, C7 (catalog consistency at boot), C3 (unknown codes)
- failure modes: C3 (the refusal happens before any write; the invitation check runs before its transaction)
- idempotency: C5 (`grant-admin` stores exactly the catalog, so running it again changes nothing)
- authorization: C8, C13, C19, C20
- concurrency: n/a - the catalog is immutable after boot; membership writes keep the optimistic concurrency of ADR-003
- data lifecycle: C15, C16, C17 (old codes stay stored and visible), C19 (and can be removed)
- dependency failure: n/a - the catalog reaches no external dependency
- state transitions: n/a - no state machine changes
- observability: n/a - `grant-admin` keeps its log events; a boot failure goes through the existing crash path

## Handoff

- Existing files touched (the 55 files that reference `MembershipPermission`, of which 27 specs, plus `start.ts`, `start.e2e.spec.ts`, `vitest.config.ts`, `shared.error.ts`, the identity module spec, the grant-admin script, the five `web/` files and the two docs) = 398 563 bytes / 4 ≈ 100k, most of it a mechanical rename of the const; plus about 15k of new files (`PermissionCatalog` with its spec, the `src/app` catalog, `IdentityPermission` with its spec, the list-permissions use case, handler and e2e spec, ADR-015) ≈ 115k in total, under the 150k budget - one builder
- **Boundary:** C1-C22 closed in one builder (uncommitted, awaiting the user's review); `pnpm typecheck`, `pnpm exec eslint .`, `pnpm test:unit:coverage`, `pnpm test:integration:coverage`, `pnpm test:e2e:coverage` (strict route statuses) and `pnpm test:coverage` all exit 0 at 100%; `pnpm --filter web build` exits 0; `pnpm format:check` fails only on `.specs/features/html-emails/verification.md`, which belongs to another workstream
- **Settled mid-build:** C14 first said "29 routes", copied from a stale test title ("28 routes" over a list of 31); it now says 32, the real count with `GET /permissions`, and the title was corrected, before the proof ran. The `PermissionCatalog` file follows the value-object naming (`permission-catalog.value-object.ts`), so the C6, C7 and C12 proofs name that spec. The four entity tests "throws InvalidMembershipPermissions when a permission is unknown" and the `identity-models` row "refuses an unknown permission" asserted the closed list that door 5 removes; they were replaced by C15 and C16. ADR-014 was taken by the notifications work that landed in the working tree meanwhile, so the decision is ADR-015. The test context (`createIdentityContext`) now carries a catalog with identity and one random module, exposed as `permissions` and `otherModulePermissions`. The RabbitMQ work was committed before the build; the notifications and HTML e-mail work of another session is staged in the index, and the files it shares with this feature were staged with part of this rename in them
- **Abandoned:** nothing
