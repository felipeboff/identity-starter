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
