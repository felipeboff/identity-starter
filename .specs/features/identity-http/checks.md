# Identity HTTP checks

Profile: light
Plan: `.specs/features/identity-http/plan.md`

## Intent

34 checks in 4 slices · 6 one-way doors · 0 open

## Checks

Proof files, abbreviated in the commands below by their full path:

- use case: `src/modules/identity/application/use-cases/authenticate.use-case.spec.ts`
- middleware: `src/modules/identity/interfaces/http/authenticate.middleware.spec.ts`
- routes: `src/modules/identity/interfaces/http/identity.routes.spec.ts`
- public routes: `src/modules/identity/interfaces/http/auth.routes.spec.ts`
- protected routes: `src/modules/identity/interfaces/http/me.routes.spec.ts`

### S1 - A protected route gets the `Actor` or answers 401 · 6 files · 14 KB · ~4k

**C1** - `AuthenticateUseCase` turns the token of an active session into `{ accountId, sessionId, membershipId, role, permissions }` taken from the token and the account's membership (AC 1)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/authenticate.use-case.spec.ts -t "returns the caller's actor for an active session"`

**C2** - `GET /me` with `authorization: Bearer <token>` answers `200` with the account of the token's caller, so the handler got that `Actor` (AC 1)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/identity.routes.spec.ts -t "reaches the handler with the token's actor"`

**C3** - A request with no `authorization` header, or with `Basic <x>`, is refused with `identity.invalid_access_token` and `AuthenticateUseCase` is never called (AC 2)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/authenticate.middleware.spec.ts -t "refuses a request without a bearer token"`

**C4** - A token `AccessToken.verify` returns `null` for is refused with `identity.invalid_access_token` (AC 3)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/authenticate.use-case.spec.ts -t "rejects a token the AccessToken port does not recognise"`

**C5** - The token of a session that is missing, belongs to another account, is revoked or is expired is refused with `identity.invalid_access_token` (AC 4)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/authenticate.use-case.spec.ts -t "rejects the token of a session that is"`

**C6** - The token of an account that is missing or deleted, or whose membership is missing or deleted, is refused with `identity.invalid_access_token` (AC 5)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/authenticate.use-case.spec.ts -t "rejects the token when the"`

**C7** - At the edge, a refused token answers exactly `401` with body `{ type: "tag:identity-starter,2026:identity.invalid_access_token", title: "Invalid access token", status: 401, code: "identity.invalid_access_token" }` (AC 2-5)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/identity.routes.spec.ts -t "answers 401 invalid_access_token with no data"`

**C8** - Each of the 14 protected routes, called without a token, answers `401` and its use case is not called (AC 6)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/identity.routes.spec.ts -t "answers 401 without a token on"`

### S2 - Public routes serve without a token · 9 files · 20 KB · ~5k

**C9** - `POST /auth/sign-up` answers `201` with `{ account, accessToken, refreshToken }` (AC 7)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/auth.routes.spec.ts -t "signs up with 201"`

**C10** - `POST /auth/sign-in` answers `200` with `{ account, accessToken, refreshToken }` (AC 8)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/auth.routes.spec.ts -t "signs in with 200"`

**C11** - `POST /auth/oauth/:provider` (`provider: "google"`) with a registered code answers `200` with `{ account, isNewAccount: true, accessToken, refreshToken }` (AC 9)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/auth.routes.spec.ts -t "signs in with oauth with 200"`

**C12** - `POST /auth/refresh` with an active session's refresh token answers `200` with `{ account, accessToken, refreshToken }` (AC 10)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/auth.routes.spec.ts -t "refreshes with 200"`

**C13** - Sign-up, sign-in, oauth and refresh each store the session with `ipAddress` = `request.ip` and `userAgent` = the `user-agent` header; with no header, `userAgent` is `""` (AC 11)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/auth.routes.spec.ts -t "stores the request ip and user agent"`
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/auth.routes.spec.ts -t "stores an empty user agent when the header is missing"`

**C14** - `POST /auth/password-reset/request` answers `204` both for a known and an unknown e-mail (AC 12)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/auth.routes.spec.ts -t "accepts a password reset request with 204"`

**C15** - `POST /auth/password-reset` with the mailed token answers `204` (AC 13)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/auth.routes.spec.ts -t "resets the password with 204"`

**C16** - `POST /auth/email-verification` with the mailed token answers `200` with `{ account }` (AC 14)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/auth.routes.spec.ts -t "verifies the email with 200"`

**C17** - Sign-in with a wrong password, refresh, password reset and e-mail verification with an unknown token each answer `401` (`Surface` statuses)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/auth.routes.spec.ts -t "answers 401 on"`

### S3 - Protected routes serve the signed-in caller · 15 files · 30 KB · ~8k

**C18** - `POST /auth/sign-out` answers `204` and the token's session is revoked (AC 15)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/me.routes.spec.ts -t "signs out with 204"`

**C19** - `GET /me` answers `200` with the caller's `{ account, membership }` (AC 16)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/me.routes.spec.ts -t "gets me with 200"`

**C20** - `PATCH /me` answers `200` with `{ account }` carrying the new name (AC 17)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/me.routes.spec.ts -t "renames me with 200"`

**C21** - `PUT /me/password` answers `204` and the new password signs in (AC 18)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/me.routes.spec.ts -t "changes my password with 204"`

**C22** - `POST /me/email-verification` answers `204` and mails a verification (AC 19)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/me.routes.spec.ts -t "requests an email verification with 204"`

**C23** - `GET /me/sessions` answers `200` with the caller's `{ sessions }` (AC 20)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/me.routes.spec.ts -t "lists my sessions with 200"`

**C24** - `POST /me/oauth/google` with a registered code answers `201` with `{ credential }` (AC 21)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/me.routes.spec.ts -t "links an oauth provider with 201"`

**C25** - `DELETE /me/oauth/google` for a linked provider answers `204` (AC 22)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/me.routes.spec.ts -t "unlinks an oauth provider with 204"`

**C26** - `DELETE /sessions/:sessionId` by the owner answers `204` and that session is revoked (AC 23)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/me.routes.spec.ts -t "revokes a session with 204"`

**C27** - `DELETE /accounts/:accountId/sessions` by the owner answers `200` with `{ revokedCount }` (AC 24)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/me.routes.spec.ts -t "revokes all sessions with 200"`

**C28** - `POST /accounts/:accountId/deactivate` by an admin answers `204` (AC 25)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/me.routes.spec.ts -t "deactivates an account with 204"`

**C29** - `POST /accounts/:accountId/reactivate` by an admin answers `200` with `{ account }` (AC 26)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/me.routes.spec.ts -t "reactivates an account with 200"`

**C30** - `PUT /members/:accountId/role` with `role: "admin"` by an admin answers `200` with `{ membership }` whose role is `admin` (AC 27)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/me.routes.spec.ts -t "changes a member role with 200"`

**C31** - `PUT /members/:accountId/permissions` with `["read", "write"]` by an admin answers `200` with `{ membership }` carrying those permissions (AC 28)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/me.routes.spec.ts -t "changes member permissions with 200"`

### S4 - Invalid input stops before the use case · 2 files · 8 KB · ~2k

**C32** - Each of the 17 routes with input (all 7 public, 10 protected), given a body or params that fail its schema, answers `400` `shared.input_invalid` with violations and its use case is not called (AC 29)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/identity.routes.spec.ts -t "answers 400 before the use case on"`

**C33** - `createIdentityRoutes` returns exactly the 21 `Surface` method + path pairs, with the authentication middleware on the 14 protected ones and none on the 7 public ones (AC 30)
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/identity.routes.spec.ts -t "declares the 21 routes"`

**C34** - The request's `ip` reaches the session, not a header (door 1) - proven by C13
Proof: `pnpm exec vitest run src/modules/identity/interfaces/http/auth.routes.spec.ts -t "stores the request ip and user agent"`

## Coverage

| Set (size)                               | Member -> proof                                                                                                                                                                                                                                                                                                                                                                                                              | Unproven |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| success status per `Surface` route (21)  | sign-up C9 · sign-in C10 · oauth C11 · refresh C12 · reset request C14 · reset C15 · email verification C16 · sign-out C18 · `GET /me` C19 · `PATCH /me` C20 · `PUT /me/password` C21 · `POST /me/email-verification` C22 · `GET /me/sessions` C23 · `POST /me/oauth` C24 · `DELETE /me/oauth` C25 · `DELETE /sessions` C26 · `DELETE /accounts/sessions` C27 · deactivate C28 · reactivate C29 · role C30 · permissions C31 | -        |
| `400` per route with input (17)          | C32, table-driven over all 17                                                                                                                                                                                                                                                                                                                                                                                                | -        |
| `401` per protected route (14)           | C8, table-driven over all 14                                                                                                                                                                                                                                                                                                                                                                                                 | -        |
| `401` per public route that lists it (4) | sign-in C17 · refresh C17 · password reset C17 · email verification C17                                                                                                                                                                                                                                                                                                                                                      | -        |
| authentication refusal causes (11)       | no header C3 · not `Bearer` C3 · unknown token C4 · session missing C5 · session of another account C5 · session revoked C5 · session expired C5 · account missing C6 · account deleted C6 · membership missing C6 · membership deleted C6                                                                                                                                                                                   | -        |
| session origin flows (4)                 | sign-up C13 · sign-in C13 · oauth C13 · refresh C13                                                                                                                                                                                                                                                                                                                                                                          | -        |
| `Landing` doors (6)                      | 1 C34 · 2 C7 · 3 C33 · 4 C9 · 5 C19 · 6 C33                                                                                                                                                                                                                                                                                                                                                                                  | -        |

- Claims naming a status code or response shape: C2, C7-C33 - each proof dispatches through `HttpDispatcher` with the real use cases over the in-memory identity context
- C1, C4-C6 assert the refusal rules at the use-case layer; C7 is the edge proof that a refusal becomes the `401` body

## Swept

- validation: C32
- failure modes: C7, C17
- idempotency: n/a - no route adds a write beyond what its use case already does
- authorization: C3-C8; owner and admin rules: existing - `AccessPolicy` inside the use cases, proven by their specs
- concurrency: n/a - the middleware and handlers keep no state between requests
- data lifecycle: n/a - nothing new is stored
- dependency failure: existing - an error from a port becomes the `500` of `http-handler` (its C9)
- state transitions: C18, C26, C28, C29 - the session and account transitions behind the routes; their guards: existing - the entities
- observability: n/a - no new logging requirement; unexpected errors already reach `ErrorReporter` through the dispatcher

## Handoff

- S1-S4 = ~19k across ~32 new files in `src/modules/identity` (~75 KB / 4), under the 150k budget - one builder
- **Boundary:** C1-C34 closed (uncommitted, awaiting the user's review)
- **Settled mid-build:** C32 and its Coverage row said 16 routes with input; the `Surface` table has 17 (all 7 public, 10 protected) - corrected before the test was written. The harness got an extra test so its error-reporter callback is covered
- **Abandoned:** none
