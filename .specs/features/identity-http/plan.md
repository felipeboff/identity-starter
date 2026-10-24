# Identity HTTP

## Problem

The 21 identity use cases can only be called from TypeScript. Nothing turns an access token into an
`Actor`, so none of the 14 operations that need a signed-in caller can be exposed, and every future
adapter (Express, Fastify, MCP) would have to reinvent how to read the token, what to do with an
invalid one and where to take the IP that sign-up, sign-in and refresh store on the session - the
`HttpRequest` of today carries no IP.

No evidence beyond the code: there is no client yet.

When this ships, identity exports the list of its routes; an adapter only registers the list, and
every protected route reaches its handler with the `Actor` built, or answers `401`.

## Flow

Reuses `HttpDispatcher`, `result` and `HttpErrorMapper` from the `http-handler` feature, the 21 use
cases, the `AccessToken.verify` port, `AccountResolver` and `MembershipResolver`, instead of
re-implementing session checks or error mapping.

1. an adapter builds the `HttpRequest`, now with `ip` (door 1) -> `HttpDispatcher` (exists, `src/shared/interfaces/http`)
2. protected route: `AuthenticateMiddleware` (door 2) reads `authorization: Bearer <token>` and calls `AuthenticateUseCase` (new, `application/use-cases`, no door) -> `AccessToken.verify` (port exists), `SessionRepository`, `AccountResolver`, `MembershipResolver` (exist) -> `Actor` -> `next({ ...request, actor })`
3. the route's handler (`src/modules/identity/interfaces/http/`, door 6 of `http-handler`) - validates body and params with `Schema.probe`, calls the use case (exists) and answers with `result`
4. `createIdentityRoutes(deps)` (door 6) returns the 21 `HttpRoute`s; `public.ts` (exists) exports the function and the deps type

## Impact

| Front       | What changes                                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| domain      | existing contract: `HttpRequest` gains `ip: string`; today only the specs in `src/shared/interfaces/http` build an `HttpRequest`                |
| domain      | new term: `AuthenticateUseCase` - access token -> `Actor`; lives in `application/use-cases` with its `.types.ts` and spec, like the others      |
| domain      | new term: `IdentityError.InvalidAccessToken` (`identity.invalid_access_token`, `unauthenticated`) - the only answer to a refused authentication |
| domain      | new terms: `AuthenticateMiddleware` and one handler per use case in `src/modules/identity/interfaces/http/`                                     |
| domain      | `public.ts` also exports `createIdentityRoutes` and `IdentityHttpDeps` - the way the composition root and the adapters reach the routes         |
| stored data | nothing to migrate                                                                                                                              |

## Relations

None - no stored-data shape change.

## Surface

Every route may also answer the errors its use case already throws, with the status of the kind
table (`403`, `404`, `409`, `422`), proven in `http-handler`. The Status column lists the success
and what this feature decides: `400` (the route's schema) and `401` (token or credentials).

Public (no token):

| Route                               | In                               | Out                                                         | Status        |
| ----------------------------------- | -------------------------------- | ----------------------------------------------------------- | ------------- |
| `POST /auth/sign-up`                | body `name`, `email`, `password` | `account` · `accessToken` · `refreshToken`                  | 201, 400      |
| `POST /auth/sign-in`                | body `email`, `password`         | `account` · `accessToken` · `refreshToken`                  | 200, 400, 401 |
| `POST /auth/oauth/:provider`        | param `provider`, body `code`    | `account` · `isNewAccount` · `accessToken` · `refreshToken` | 200, 400      |
| `POST /auth/refresh`                | body `refreshToken`              | `account` · `accessToken` · `refreshToken`                  | 200, 400, 401 |
| `POST /auth/password-reset/request` | body `email`                     | nothing                                                     | 204, 400      |
| `POST /auth/password-reset`         | body `token`, `newPassword`      | nothing                                                     | 204, 400, 401 |
| `POST /auth/email-verification`     | body `token`                     | `account`                                                   | 200, 400, 401 |

Protected (`authorization: Bearer <accessToken>`):

| Route                                  | In                                    | Out                      | Status        |
| -------------------------------------- | ------------------------------------- | ------------------------ | ------------- |
| `POST /auth/sign-out`                  | -                                     | nothing                  | 204, 401      |
| `GET /me`                              | -                                     | `account` · `membership` | 200, 401      |
| `PATCH /me`                            | body `name`                           | `account`                | 200, 400, 401 |
| `PUT /me/password`                     | body `oldPassword`, `newPassword`     | nothing                  | 204, 400, 401 |
| `POST /me/email-verification`          | -                                     | nothing                  | 204, 401      |
| `GET /me/sessions`                     | -                                     | `sessions`               | 200, 401      |
| `POST /me/oauth/:provider`             | param `provider`, body `code`         | `credential`             | 201, 400, 401 |
| `DELETE /me/oauth/:provider`           | param `provider`                      | nothing                  | 204, 400, 401 |
| `DELETE /sessions/:sessionId`          | param `sessionId`                     | nothing                  | 204, 400, 401 |
| `DELETE /accounts/:accountId/sessions` | param `accountId`                     | `revokedCount`           | 200, 400, 401 |
| `POST /accounts/:accountId/deactivate` | param `accountId`                     | nothing                  | 204, 400, 401 |
| `POST /accounts/:accountId/reactivate` | param `accountId`                     | `account`                | 200, 400, 401 |
| `PUT /members/:accountId/role`         | param `accountId`, body `role`        | `membership`             | 200, 400, 401 |
| `PUT /members/:accountId/permissions`  | param `accountId`, body `permissions` | `membership`             | 200, 400, 401 |

## Landing

| One-way door                           | Literal shape                                                                                                                                                                                                                                                            | Alternative rejected                                                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. IP on the request (shared contract) | `HttpRequest` gains `ip: string`; the adapter fills it with the IP the framework resolves (`req.ip` in Express and Fastify, honouring the trusted-proxy setting)                                                                                                         | reading `x-forwarded-for` in the handler - forgeable without a proxy in front, and missing on a direct call (user chose)                                           |
| 2. Authentication refusal              | header `authorization: Bearer <accessToken>`; `AuthenticateMiddleware implements HttpMiddleware<undefined, Actor>`; every failure (missing header, invalid token, inactive session, account or membership) answers `401` `identity.invalid_access_token`, with no `data` | one code per cause (`session_revoked` 422, `account_deleted` 422...) - tells a prober which part failed and makes clients handle several codes for "sign in again" |
| 3. Paths (public contract)             | the 21 paths in `Surface`: `/auth/*` without sign-in, `/me/*` acting on the caller, `/sessions/:sessionId`, `/accounts/:accountId/*` and `/members/:accountId/*` acting on someone else; no version prefix in the module                                                 | a `/api/v1` prefix in the module's routes - the prefix belongs to the adapter, and every module would have to repeat it                                            |
| 4. Tokens in the body                  | sign-up, sign-in, oauth and refresh answer `{ account, accessToken, refreshToken }` as JSON; `POST /auth/refresh` takes `{ refreshToken }` in the body                                                                                                                   | refresh token in an `httpOnly` cookie - `HttpResult` has no cookies yet and MCP has no cookie; moving to a cookie later changes the contract of these 4 endpoints  |
| 5. Success body                        | the use case's output as it is: `{ account }`, `{ membership }`, `{ sessions }`, `{ credential }`, `{ revokedCount }`; dates become ISO strings in JSON                                                                                                                  | one response DTO per route - the mappers in `application/mappers` already give the public shape, and a second mapping would drift                                  |
| 6. Route factory                       | `createIdentityRoutes(deps: IdentityHttpDeps): HttpRoute<Actor \| undefined>[]` exported by `public.ts`; `deps` carries the use-case instances and the `AuthenticateMiddleware`                                                                                          | each handler exported on its own from `public.ts` - the composition root would have to know each one's method, path and middleware                                 |

- Nothing else in this change is hard to reverse

## Criteria

### S1: A protected route gets the `Actor` or answers 401 (P1)

The token in the header becomes the caller's `Actor`; every failure is the same `401`.

**Acceptance Criteria**

1. WHEN a protected route receives `authorization: Bearer <token>` of an active session THEN the handler SHALL receive the `Actor` with the token's `accountId` and `sessionId` and the `membershipId`, `role` and `permissions` of the account's membership
2. IF the `authorization` header is missing or does not start with `Bearer ` THEN the route SHALL answer `401` `identity.invalid_access_token` with no `data` and SHALL NOT call the use case
3. IF `AccessToken.verify` returns `null` for the token THEN the route SHALL answer the same `401` as criterion 2
4. IF the token's session does not exist, belongs to another account, is revoked or is expired THEN the route SHALL answer the same `401` as criterion 2
5. IF the token's account or membership does not exist or is deleted THEN the route SHALL answer the same `401` as criterion 2
6. WHEN any of the 14 protected routes in `Surface` is called without a token THEN it SHALL answer `401` - no protected route is left without the middleware

**Independent test:** `GET /me` with the token of a seeded session, with no header, with a token `FakeAccessToken` does not recognise and with the session revoked.

### S2: Public routes serve without a token (P1)

Sign-up, sign-in, refresh, password reset and e-mail verification work through the route.

**Acceptance Criteria**

7. WHEN `POST /auth/sign-up` receives a valid `name`, `email` and `password` THEN it SHALL answer `201` with `{ account, accessToken, refreshToken }`
8. WHEN `POST /auth/sign-in` receives an account's e-mail and password THEN it SHALL answer `200` with `{ account, accessToken, refreshToken }`
9. WHEN `POST /auth/oauth/:provider` receives a `code` the provider accepts THEN it SHALL answer `200` with `{ account, isNewAccount, accessToken, refreshToken }`
10. WHEN `POST /auth/refresh` receives the refresh token of an active session THEN it SHALL answer `200` with `{ account, accessToken, refreshToken }`
11. WHEN sign-up, sign-in, oauth or refresh creates a session THEN it SHALL store `ipAddress` equal to `request.ip` and `userAgent` equal to the `user-agent` header, or `""` when the header is missing
12. WHEN `POST /auth/password-reset/request` receives an `email`, whether or not an account has it, THEN it SHALL answer `204`
13. WHEN `POST /auth/password-reset` receives a pending `token` and a `newPassword` THEN it SHALL answer `204`
14. WHEN `POST /auth/email-verification` receives a pending `token` THEN it SHALL answer `200` with `{ account }`

**Independent test:** sign-up, then sign-in with the same password, then refresh with the returned refresh token, checking the session's IP and user agent.

### S3: Protected routes serve the signed-in caller (P1)

Every operation on the caller's own account and on other accounts works through the route, with the token's `Actor`.

**Acceptance Criteria**

15. WHEN `POST /auth/sign-out` is called THEN it SHALL answer `204` and the token's session SHALL be revoked
16. WHEN `GET /me` is called THEN it SHALL answer `200` with the caller's `{ account, membership }`
17. WHEN `PATCH /me` receives `name` THEN it SHALL answer `200` with `{ account }` carrying the new name
18. WHEN `PUT /me/password` receives the current password and a new one THEN it SHALL answer `204`
19. WHEN `POST /me/email-verification` is called THEN it SHALL answer `204`
20. WHEN `GET /me/sessions` is called THEN it SHALL answer `200` with the caller's `{ sessions }`
21. WHEN `POST /me/oauth/:provider` receives an accepted `code` THEN it SHALL answer `201` with `{ credential }`
22. WHEN `DELETE /me/oauth/:provider` is called for a linked provider THEN it SHALL answer `204`
23. WHEN `DELETE /sessions/:sessionId` is called by the session's owner THEN it SHALL answer `204`
24. WHEN `DELETE /accounts/:accountId/sessions` is called by the account's owner THEN it SHALL answer `200` with `{ revokedCount }`
25. WHEN `POST /accounts/:accountId/deactivate` is called by an admin THEN it SHALL answer `204`
26. WHEN `POST /accounts/:accountId/reactivate` is called by an admin for a deactivated account THEN it SHALL answer `200` with `{ account }`
27. WHEN `PUT /members/:accountId/role` receives a valid `role` from an admin THEN it SHALL answer `200` with `{ membership }`
28. WHEN `PUT /members/:accountId/permissions` receives valid `permissions` from an admin THEN it SHALL answer `200` with `{ membership }`

**Independent test:** sign in a seeded admin, then `PUT /members/:accountId/role` on another account and `GET /me` of the other account showing the new role.

### S4: Invalid input stops before the use case (P1)

**Acceptance Criteria**

29. IF a route with input receives a body or params that fail its schema THEN it SHALL answer `400` `shared.input_invalid` with the violations and SHALL NOT call the use case
30. The `createIdentityRoutes` factory SHALL return exactly the 21 routes in `Surface`, with the same method and path, and the authentication middleware only on the 14 protected ones

**Independent test:** `POST /auth/sign-up` with no `email` and `DELETE /sessions/abc` (invalid id), checking the violations.

## Out of scope

| Excluded                                                     | Why                                                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Express, Fastify and MCP adapters                            | the user plugs them in afterwards; this feature delivers the route list they register                  |
| Composition root wiring real repositories into the use cases | no persistence (Mongo) or `AccessToken` (JWT) adapter exists yet; the factory receives ready use cases |
| JWT implementation of the `AccessToken` port                 | separate feature; tests use the existing `FakeAccessToken`                                             |
| Refresh token in a cookie                                    | `HttpResult` has no cookies; recorded in door 4                                                        |
| Rate limiting on `/auth/*`                                   | belongs to the adapter (and the planned Redis)                                                         |
| Invitations (`Invitation`)                                   | the entity exists, but no use case uses it yet                                                         |
| Grouping middleware per module (`HttpRouteGroup`)            | each protected route declares the middleware; a group waits until another module has routes            |

## Assumptions

| Assumption                                    | Chosen default                                                                                                                                                               | Rationale                                                                                                    | Confirmed? |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------- |
| What route schemas validate                   | type and presence only: `v.string()`, `v.email()`, `v.objectId()` for ids, `v.enum` for `role` and `permissions`; domain rules (password length, name) stay in the use cases | one rule in two places drifts; the use case already throws the right error, which becomes 400 or 422 by kind | y          |
| `ip` when the adapter cannot resolve it       | the adapter passes `""`; the session stores `""`                                                                                                                             | the session needs a string and the IP is informational, not an access rule                                   | y          |
| Sign-out of an already revoked session        | never happens: the middleware refuses that session's token with `401` before the use case                                                                                    | follows from door 2                                                                                          | y          |
| `GET /me/sessions` instead of `GET /sessions` | listing sits under `/me` because the use case lists only the caller's sessions                                                                                               | the path says whose sessions they are                                                                        | y          |
| Status of `POST /auth/oauth/:provider`        | always `200`, with `isNewAccount` in the body, even when it creates the account                                                                                              | the client does the same in both cases; `isNewAccount` already tells them apart                              | y          |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface                  | Decision                       | Landing                                                       |
| ------------------------ | ------------------------------ | ------------------------------------------------------------- |
| every route in `Surface` | response shape                 | AC 7-10, 12-28 and door 5                                     |
| every route in `Surface` | error shape with its codes     | AC 2, 29 and the kind table of `http-handler`                 |
| protected routes         | who may call it                | AC 1-6; owner/admin rules stay in the existing `AccessPolicy` |
| every route in `Surface` | versioning                     | n/a - a version prefix belongs to the adapter (door 3)        |
| `/auth/*`                | what happens at the rate limit | n/a - rate limiting belongs to the adapter, out of scope      |

## Sources

- User request (2026-10-22): "implementa o handler do identity"; authentication included; `ip` as a field of `HttpRequest`; plan approved in pt-BR
- `.specs/features/http-handler/plan.md` - the `HttpHandler`, `HttpMiddleware`, `HttpRoute` contract, RFC 9457 and the kind table
