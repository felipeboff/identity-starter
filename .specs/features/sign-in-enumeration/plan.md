# Sign-in without account enumeration

## Problem

Today `POST /auth/sign-in` answers differently depending on the state of the e-mail, before it
checks the password:

| E-mail state                                   | Answer today                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| no account                                     | `404 identity.account_not_found`, with `data.email`                  |
| deactivated account                            | `422 identity.account_deleted`, with `data.accountId` (internal id)  |
| account with no e-mail credential (OAuth only) | `404 identity.credential_not_found`                                  |
| e-mail credential with no password             | `422 identity.credential_password_not_set`, with `data.credentialId` |
| credential of another account                  | `409 identity.credential_account_mismatch`, with both ids            |
| wrong password                                 | `401 identity.invalid_credentials`, with `data.email`                |

Besides the code, three side channels tell the same thing:

- **Throttle.** `SignInThrottle` records a failure only when the password is wrong. On the 6th
  attempt in 15 min, an e-mail with an account gets `429 identity.sign_in_locked` and one without
  an account never does.
- **Throttle key.** The key is the e-mail as it came in, but the lookup is by lowercase e-mail, so
  `Ana@x.com` and `ana@x.com` count in separate windows and the per-e-mail lock is bypassed by
  varying the case.
- **Response time.** argon2 only runs when there is a credential with a password, so whoever has
  no account gets the answer without the cost of the hash.

Underneath, `HttpErrorMapper` copies the `data` of any `AppError` into the response body. Internal
ids and e-mails go out to the client, and the `identity.password_hash_*` definitions carry the hash
itself. The front end (`web/src/api/api-error.ts`) reads only four fields: `violations`,
`retryAfterSeconds`, `required` and `anyOf`.

Who pays: every account owner, because anyone can confirm their e-mail is registered and aim
phishing and credential stuffing at accounts that exist. Whoever adopts the boilerplate inherits
the problem. The limit of 20 per IP in 15 min only slows down whoever rotates IPs.

Evidence: none from production, because the project has no real traffic yet. The source is the
architectural analysis pasted in the conversation, item 3.7 ("High security priority"), checked
against the code on `master` (4cf97b1).

When this ships, whoever does not know the password gets the same answer for any e-mail:
`401 identity.invalid_credentials` with no `data`, the same throttle and the same hash cost. The
owner who gets the password right on a deactivated account learns about the deactivation. The
internal reason of each refusal stays in the log, not in the answer.

## Flow

Reuses `SignInThrottle` and `RateLimiter`, the `PasswordHasher` port with `Argon2PasswordHasher`,
the `identity.sign_in_failed` event and `HttpErrorMapper`. No new service.

1. `POST /auth/sign-in` -> `SignInWithEmailHandler` (exists, `src/modules/identity/presentation`) validates the input and calls `SignInWithEmailUseCase` (exists, `src/modules/identity/application/use-cases`)
2. `SignInThrottle` (exists, `application/services`) checks the lock with the normalized e-mail (trimmed and lowercase); a locked e-mail gets `429 identity.sign_in_locked`
3. the use case reads the account and the e-mail credential through the repositories (exist, `application/ports`) and calls `PasswordHasher.verify` (exists, door 2) exactly once: with the stored hash when there is an account and an active credential with a password, otherwise with `null`, which verifies against the decoy hash
4. password does not match (any cause from step 3) -> records the failure in `SignInThrottle`, logs `identity.sign_in_failed` with the internal cause in `reason` and throws `identity.invalid_credentials`
5. password matches -> resets the throttle and only then checks the deactivated account (`422`), the credential of another account (`409`) and the membership (`404`/`422`); when those pass, issues the session as today
6. `HttpErrorMapper` (exists, `src/shared/presentation/http`) builds the problem details with the error's `data`, unchanged; `identity.invalid_credentials` carries no `data` (door 4)
7. out: `200` with the session, or the problem details; on the sign-in `401`s, with no `data`

## Impact

| Front       | What changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| behaviour   | `POST /auth/sign-in` stops answering `identity.account_not_found`, `identity.credential_not_found`, `identity.credential_deleted` and `identity.credential_password_not_set`; `identity.account_deleted` and `identity.credential_account_mismatch` only come out after the right password. Who reads it: `web/src/i18n/error-messages.ts` (the messages stay, other routes use the codes; the sign-in screen shows "E-mail ou senha incorretos.") and `identity.failures.e2e.spec.ts` |
| front end   | `web/`: the sign-in form shows its own copy for the answers after the right password (`account_deleted` asks for an admin; `credential_account_mismatch`, `membership_not_found` and `membership_deleted` say the account is unavailable) through a `messages` override on `Form`; `identity.sign_in_locked` no longer says "wrong passwords"; the explorer note for `POST /auth/sign-in` describes the uniform `401`                                                                  |
| behaviour   | `identity.invalid_credentials` carries no `data` on any route: `POST /auth/sign-in`, `PUT /me/password` and `POST /me/email` stop echoing the e-mail. Who reads it: nobody - `web/src/api/api-error.ts` reads only `violations`, `retryAfterSeconds`, `required` and `anyOf`                                                                                                                                                                                                           |
| behaviour   | an e-mail with no account starts accumulating failures and is locked after 5 in 15 min, as already happened to an e-mail with an account                                                                                                                                                                                                                                                                                                                                               |
| domain      | existing term: `PasswordHasher.verify` accepts `hash: null`; who implements it: `Argon2PasswordHasher` and the tests' `FakePasswordHasher`. Who calls it: sign-in, `change-password` and `request-email-change` (the last two keep passing the hash)                                                                                                                                                                                                                                   |
| cost        | one argon2id verification per attempt also for an e-mail with no account; bounded by the existing 20 per IP in 15 min                                                                                                                                                                                                                                                                                                                                                                  |
| stored data | the throttle keys in Redis start using the lowercase e-mail; old counters with uppercase letters expire within 15 min; nothing to migrate                                                                                                                                                                                                                                                                                                                                              |
| docs        | `docs/auth-front-end-contract.md` gains the sign-in answers                                                                                                                                                                                                                                                                                                                                                                                                                            |

## Relations

None - no stored-data shape change; accounts, credentials and memberships stay as they are.

## Surface

| Route                | In                              | Out                                                                                                        | Status                                          |
| -------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `POST /auth/sign-in` | `email`, `password` (unchanged) | `account` · `accessToken` · `refreshToken` (unchanged); failure: problem details, the `401` with no `data` | `200`, `400`, `401`, `404`, `409`, `422`, `429` |

`404` now means only a missing membership after the right password; `422`, a deactivated account
or a deleted membership after the right password. On `PUT /me/password` and `POST /me/email` the
statuses stay the same and only the `401` loses its `data` (Impact).

## Landing

| One-way door                                                                                                                    | Literal shape                                                                                                                                                                                                                                                                                                                                                  | Alternative rejected                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Exposure of `data` decided on the error definition (precedent) - superseded by door 4, at the user's request after the build | `defineError<Data>(code, kind, { exposeData: true })`; without the third argument, `exposeData` is `false`; `AppError` carries `exposeData` from the definition; `HttpErrorMapper` writes `data` only when `error.exposeData`. Released: `SharedError.InputInvalid`, `SharedError.RateLimited`, `SharedError.PermissionMissing`, `IdentityError.SignInLocked`  | an allowlist of codes in `HttpErrorMapper` - `shared` would have to know module codes (ESLint forbids it) and every new module would edit `shared`; `publicData` on each `throw` - one forgotten `throw` leaks, and there are dozens of `throw`s against four definitions; a denylist of sensitive keys (`email`, `accountId`) - a new key leaks by default |
| 2. Decoy verification in the `PasswordHasher` port                                                                              | `verify(password: string, hash: string \| null): Promise<boolean>`; with `null`, `Argon2PasswordHasher` verifies against a decoy hash generated once per process by its own `hash()` (same argon2id options) and returns `false`                                                                                                                               | skip the verification when there is no hash (what exists) - the time gives the account away; a decoy hash fixed in the code - ends up with a different cost when the argon2 options change; a random delay with `setTimeout` - does not burn CPU like argon2 and is distinguishable under load                                                              |
| 3. Public contract of sign-in                                                                                                   | before the password matches, every failure is `401 identity.invalid_credentials` with no `data`; `identity.account_deleted` (`422`) and `identity.credential_account_mismatch` (`409`) only after the right password                                                                                                                                           | distinct codes to guide the user ("account not found", "sign in with Google") - they are exactly the oracle; always `401`, even for a deactivated account with the right password - refused by the user: the owner would not know the account was deactivated                                                                                               |
| 4. `AppError.data` is the API payload (precedent, replaces door 1)                                                              | whatever an `AppError` carries in `data` goes into the problem details, as before this feature; what the client must not see stays out of the error and goes to the logger (`identity.sign_in_failed` keeps the e-mail, the IP and the internal reason); `InvalidCredentials: defineError("identity.invalid_credentials", "unauthenticated")`, with no payload | door 1's `exposeData` flag - a second place to decide what leaks, when the error's own payload already decides it; the logger is where internal detail belongs                                                                                                                                                                                              |

- Nothing else in this change is hard to reverse

## Criteria

### S1: Without the right password, every e-mail gets the same answer (P1)

Whoever does not know the password learns nothing about the e-mail.

**Acceptance Criteria**

1. IF there is no stored password to check (e-mail with no account, account with no e-mail credential, deleted e-mail credential or credential with no password) THEN the system SHALL answer `401 identity.invalid_credentials` with no `data`
2. IF the password does not match the stored one, including on a deactivated account, THEN the system SHALL answer `401 identity.invalid_credentials` with no `data`
3. WHEN an attempt passes the per-e-mail lock THEN the system SHALL call `PasswordHasher.verify` exactly once: with the stored hash when it exists, otherwise with `null`
4. WHEN `Argon2PasswordHasher.verify` receives `null` THEN it SHALL verify the password against an argon2id hash generated by its own `hash()` and SHALL return `false`
5. WHEN the system answers `401 identity.invalid_credentials` on sign-in THEN it SHALL record one failure in `SignInThrottle`, whether the e-mail has an account or not
6. IF an e-mail accumulates 5 failures in 15 min, whether it has an account or not, THEN the 6th attempt SHALL answer `429 identity.sign_in_locked` with `data.retryAfterSeconds`
7. The system SHALL use as the `SignInThrottle` key the e-mail trimmed and in lowercase: failures with `Ana@Example.com` and with `ana@example.com` count in the same window
8. WHEN sign-in fails with `401` THEN the system SHALL log `warn` `identity.sign_in_failed` with `reason` equal to the internal cause (`identity.account_not_found`, `identity.credential_not_found`, `identity.credential_deleted`, `identity.credential_password_not_set` or `identity.invalid_credentials`), `ipAddress` and `email`

**Independent test:** `POST /auth/sign-in` with an e-mail with no account and with a wrong password for an e-mail with an account returns the same body `{ type, title, status: 401, code: "identity.invalid_credentials" }`, with no `data`.

### S2: With the right password, the owner learns the state of the account (P1)

The errors that depend on the account only appear to whoever proved to be the owner.

**Acceptance Criteria**

9. WHEN the password matches and the account is deactivated THEN the system SHALL answer `422 identity.account_deleted`
10. WHEN the password matches and the e-mail credential belongs to another account THEN the system SHALL answer `409 identity.credential_account_mismatch`
11. WHEN the password matches and the account has no membership THEN the system SHALL answer `404 identity.membership_not_found`

**Independent test:** a deactivated account answers `401` with the wrong password and `422 identity.account_deleted` with the right password.

### S3: `invalid_credentials` carries nothing but the code (P1)

The e-mail stays in the log; the API answer carries no payload on any route that refuses a password.

**Acceptance Criteria**

12. The system SHALL build `identity.invalid_credentials` with no `data` on every route that refuses a password: `POST /auth/sign-in`, `PUT /me/password` and `POST /me/email`

**Independent test:** `POST /me/email` with a wrong password answers `401 identity.invalid_credentials` with no `data` key.

## Out of scope

| Excluded                                                            | Why                                                                                                                                             |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| enumeration on sign-up (`400 identity.account_email_taken`)         | closing it needs another sign-up flow (always `201` and an e-mail to the owner who already exists), a separate product decision                 |
| enumeration on authenticated routes (`POST /me/email`, invitations) | they need a session and, for invitations, a permission; the caller is already a member                                                          |
| per-e-mail lock as denial of service                                | anyone can already lock the sign-in of an e-mail with an account for 15 min; CAPTCHA or progressive delay is another capability                 |
| normalized key on the per-e-mail reset limit                        | `PASSWORD_RESET_REQUEST_PER_EMAIL` has the same case problem, but the route always answers `204` and does not enumerate; it goes in a next item |

## Assumptions

| Assumption                               | Chosen default                                                                                                                            | Rationale                                                                                                                                                  | Confirmed? |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| OAuth-only account trying a password     | `401 identity.invalid_credentials`, with no hint to sign in with Google or GitHub                                                         | the hint reveals that the account exists; the sign-in screen already shows the OAuth buttons; the user approved the plan                                   | y          |
| equal response time                      | the mechanism is reading account and credential on every attempt and running one argon2 verification; latency does not become a criterion | no single run proves an equal time; the metric, if it comes, belongs to OpenTelemetry (_planned_); the user approved the plan                              | y          |
| which errors keep `data`                 | every error keeps the payload it carries; only `identity.invalid_credentials` loses it (door 4)                                           | the user's rule: `AppError.data` goes to the API and the internal detail goes to the logger; the errors after the right password carry the owner's own ids | y          |
| inconsistencies after the right password | `409` (credential of another account), `404` and `422` (membership) stay distinct, with their current `data`                              | they only appear to whoever got the password right, so they do not enumerate; making them uniform would be another item; the user approved the plan        | y          |
| normalize the throttle key in this item  | yes, the e-mail trimmed and in lowercase                                                                                                  | criterion 6 only holds if case does not open a new window; it is the same throttle line this item already changes; the user approved the plan              | y          |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface                                    | Decision                | Landing                                                                                                                                                     |
| ------------------------------------------ | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API `POST /auth/sign-in`                   | error shape and codes   | AC 1, 2, 6, 9, 10, 11; existing - RFC 9457 problem details from `HttpErrorMapper`                                                                           |
| API `POST /auth/sign-in`                   | response shape          | existing - `account`, `accessToken`, `refreshToken`, unchanged                                                                                              |
| API `POST /auth/sign-in`                   | who may call it         | existing - public route                                                                                                                                     |
| API `POST /auth/sign-in`                   | rate limits             | AC 5, 6, 7; existing - 20 per IP in 15 min (`SIGN_IN_PER_IP`)                                                                                               |
| all routes                                 | error shape (`data`)    | AC 12; existing - `HttpErrorMapper` sends the error's `data`, door 4 decides what an error carries                                                          |
| all routes                                 | versioning              | n/a - the API is not versioned; the contract changes by removing codes and the `401` payload, recorded in the doc                                           |
| document `docs/auth-front-end-contract.md` | structure and next step | existing - gains a sign-in section in the format of the others; the reader shows the `invalid_credentials` message and the `retryAfterSeconds` of the `429` |

## Sources

- Architectural analysis pasted in the conversation, item 3.7 "Differentiation of errors in authentication" - the problem and the recommendation to keep the internal errors only in the logs
- `docs/auth-front-end-contract.md` - the `data` fields the front end uses today
