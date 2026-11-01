# Auth contract for front ends

What a client (the `web/` app, a mobile app) has to do so sign-in stays safe. The API enforces
the rest.

## OAuth sign-in (Google, GitHub)

The front end owns the redirect, the `state` and the PKCE pair. The API only exchanges the
code.

1. **Before redirecting**, generate and keep in `sessionStorage`:
   - `state`: at least 16 random bytes, base64url;
   - `codeVerifier`: 43–128 characters from `A-Z a-z 0-9 - . _ ~` (32 random bytes in
     base64url give 43);
   - `codeChallenge = base64url(SHA-256(codeVerifier))`.
2. **Redirect** to the provider with `state`, `code_challenge=<codeChallenge>` and
   `code_challenge_method=S256`, plus the usual `client_id`, `redirect_uri` and `scope`:
   - Google: `https://accounts.google.com/o/oauth2/v2/auth`, `response_type=code`,
     `scope=openid email profile`;
   - GitHub: `https://github.com/login/oauth/authorize`, `scope=read:user user:email`.
3. **On the callback page**, refuse the login when the `state` query parameter is missing or
   differs from the stored one. This is the CSRF protection, and only the front end can do it.
4. **Exchange the code**:

   ```http
   POST /api/auth/oauth/:provider
   { "code": "<code>", "codeVerifier": "<codeVerifier>" }
   ```

   Linking a provider to the signed-in account is the same body on `POST /api/me/oauth/:provider`.
   `codeVerifier` is optional for compatibility, but send it: it ties the code to the
   browser that started the login, so an intercepted code is useless on its own.

5. Delete `state` and `codeVerifier` from storage, whatever the answer.

The `redirect_uri` the front end sends must be the one in the API config
(`GOOGLE_REDIRECT_URI`, `GITHUB_REDIRECT_URI`), character by character.

## Passwords

`sign-up`, `password-reset` and `me/password` accept 12–128 characters, with no other rule.
Shorter or longer answers `400 shared.input_invalid` with the field in `data.violations`. Show
the limits in the form instead of discovering them from the error.

Every `400 shared.input_invalid` lists `data.violations` as `{ field, reason }`: `field` is the
dotted path of the input (`permissions.1`) and `reason` is the JSON Schema keyword that failed
(`required`, `minLength`, `maxLength`, `format`, `enum`, `pattern`, `type`).

## Too many requests

Sensitive routes answer `429 shared.rate_limited` with `data.retryAfterSeconds` once one IP
calls them too often:

| Route                                                    | Limit per IP  |
| -------------------------------------------------------- | ------------- |
| `POST /auth/sign-up`                                     | 10 per hour   |
| `POST /auth/sign-in`                                     | 20 per 15 min |
| `POST /auth/oauth/:provider`, `POST /me/oauth/:provider` | 20 per 15 min |
| `POST /auth/refresh`                                     | 60 per 15 min |
| `POST /auth/password-reset/request`                      | 5 per hour    |
| `POST /auth/password-reset`                              | 10 per hour   |
| `POST /auth/email-verification`                          | 10 per hour   |
| `POST /me/email-verification`                            | 5 per hour    |
| `PUT /me/password`                                       | 10 per hour   |

On top of that:

- 5 wrong passwords for one e-mail in 15 minutes lock that e-mail's sign-in:
  `429 identity.sign_in_locked`, with `data.retryAfterSeconds`, even with the right password.
- Past 3 reset requests for one e-mail in an hour, the API still answers `204` but sends no
  e-mail, so the answer never tells whether the address has an account.

Show "try again in N seconds" from `retryAfterSeconds`; do not retry automatically.

## Sign-up and e-mail verification

`POST /auth/sign-up` e-mails a verification link to the new address (`<APP_URL>/verify-email?token=`).
The sign-up answers `201` even if that e-mail fails; `POST /me/email-verification` sends a new
link. The `/verify-email` page posts the token to `POST /auth/email-verification`. Accounts
created through OAuth or an invitation start verified.

## Permissions

Access depends on the member's `permissions` only; `role` is a label to show and grants nothing.
Each operation that goes beyond the caller's own account requires its own permission:

| Permission                  | Allows                                                           |
| --------------------------- | ---------------------------------------------------------------- |
| `invitation.create`         | `POST /invitations`                                              |
| `invitation.read`           | `GET /invitations`                                               |
| `invitation.revoke`         | `DELETE /invitations/:invitationId`                              |
| `account.reactivate`        | `POST /accounts/:accountId/reactivate`                           |
| `account.deactivate`        | `POST /accounts/:accountId/deactivate` on someone else's account |
| `session.read`              | `GET /accounts/:accountId/sessions` on someone else's account    |
| `session.revoke`            | `DELETE /sessions/:sessionId` on someone else's session          |
| `session.revoke_all`        | `DELETE /accounts/:accountId/sessions` on someone else's account |
| `member.read`               | `GET /members`                                                   |
| `member.role.update`        | `PUT /members/:accountId/role`                                   |
| `member.permissions.update` | `PUT /members/:accountId/permissions`                            |

Nobody changes their own role or permissions.

A missing permission answers `403 shared.permission_missing` with `data.required` (the missing
code), or with `data.anyOf` (the accepted codes) where any one of them is enough. A rule about the
target answers `403 identity.forbidden`: acting on someone else's account without the
operation's permission, granting or removing a permission you do not hold, or changing your own
role or permissions.

`PUT /members/:accountId/permissions` replaces the whole set, so send the member's current
permissions with your changes: the ones you do not hold must stay exactly as they are.

## Members

`GET /members` (`member.read`) lists the members, each as `{ account, membership }`, in
membership id order. Deactivated accounts are included, with `account.deletedAt` set. `limit` goes
from 1 to 100 (50 by default); send the answer's `nextCursor` as `cursor` to get the next page,
until it comes back `null`:

```http
GET /api/members?limit=50&cursor=<nextCursor>
```

## Invitations

An inviter may only grant permissions they already hold, with any role
(`403 identity.forbidden` otherwise).

| Route                               | What it does                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /invitations`                 | `{ email, role, permissions }`; e-mails a 7-day link (`<APP_URL>/accept-invitation?token=`) and replaces a pending invitation to the same e-mail |
| `GET /invitations`                  | pending invitations, newest first                                                                                                                |
| `DELETE /invitations/:invitationId` | revokes one (`204`); an accepted one answers `422`                                                                                               |
| `POST /auth/invitations/accept`     | `{ token, name, password }`; creates the account with the invited role, already verified, and signs it in (`201`, same body as sign-up)          |

## Changing the e-mail

1. `POST /me/email` with `{ newEmail, password }` (the current password). A 1-hour link goes to
   the new address (`<APP_URL>/confirm-email-change?token=`). Accounts that only sign in with
   OAuth answer `422 identity.email_change_needs_password`.
2. The `/confirm-email-change` page posts `{ token }` to `POST /auth/email-change`, signed in or
   not. The account and its password sign-in move to the new e-mail, **every session ends**, and
   the old address gets a notice. The client must sign in again with the new e-mail.

## Sign-in methods

| Route                        | What it does                                                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `GET /me/credentials`        | the account's sign-in methods (`provider`: `email`, `google`, `github`), oldest first, without the password |
| `POST /me/oauth/:provider`   | links a provider; same body and flow as the OAuth sign-in (`201`)                                           |
| `DELETE /me/oauth/:provider` | unlinks it (`204`); the last method left answers `422 identity.last_credential_cannot_be_removed`           |

An account made with GitHub or Google gets a password through the forgotten-password flow, so it
keeps a way in if the provider is lost: `POST /auth/password-reset/request` e-mails the link to
any active account, with or without a password, and `POST /auth/password-reset` creates the
password sign-in, with the account's e-mail, when the account has none.

## Sessions

Each sign-in opens a new session; the others stay active, with no limit per account.

| Route                               | What it does                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| `GET /me/sessions`                  | active sessions, newest first; `current: true` marks the one making the call  |
| `GET /accounts/:accountId/sessions` | someone's active sessions, newest first (`session.read`, or your own account) |
| `DELETE /sessions/:sessionId`       | ends one session (`204`)                                                      |
| `DELETE /me/sessions`               | ends every session except the current one; answers `{ revokedCount }`         |
| `POST /auth/sign-out`               | ends the current session                                                      |

## Refresh tokens

Every refresh rotates the token: keep only the newest one. Sending an older token again is
treated as theft: the API revokes every session of the account and answers
`401 identity.refresh_token_reused`. The client must then sign in again.

Two tabs refreshing at the same time with the same token trigger this too. Refresh from one
place (a single in-flight promise, or a lock across tabs).

## CORS

Browsers may call the API only from the origins in `CORS_ORIGINS` (default
`http://localhost:5173`, the Vite dev server). Requests from other origins still reach the API
but get no CORS headers, so the browser blocks the answer.
