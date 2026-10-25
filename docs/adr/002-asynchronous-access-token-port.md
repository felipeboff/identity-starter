# ADR-002: Asynchronous AccessToken Port

- **Date**: 2026-10-24
- **Status**: Accepted
- **Deciders**: Felipe Boff
- **Tags**: identity, security, ports, api-contract

## Context and Problem Statement

The identity module signs and checks its own JWT access tokens through the `AccessToken` port.
The port was synchronous (`issue(): string`, `verify(): AccessTokenClaims | null`), and only the
in-memory fake implemented it. The real adapter had to use HS256 with the secret from config,
and `jose`, the library chosen for JWTs, only has an asynchronous API (`SignJWT.sign`,
`jwtVerify`). Keeping the port synchronous meant giving up `jose`.

## Decision Drivers

- Use a maintained, audited library for signing and verifying tokens
- Keep claims checks (`alg`, `exp`, required claims, `alg: none`) out of hand-written code
- Change the contract once, before more callers depend on it

## Considered Options

- Make the port asynchronous and use `jose`
- Keep the port synchronous and sign HS256 by hand with `node:crypto` (`createHmac`)

## Decision Outcome

Chosen option: **make the port asynchronous and use `jose`**. Verification is where JWT bugs
live (algorithm confusion, missing expiry checks, unpadded base64url), and `jose` already handles
them.

`src/modules/identity/application/ports/access-token.ts`:

```ts
issue(claims: AccessTokenClaims): Promise<string>;
verify(token: string): Promise<AccessTokenClaims | null>;
```

`JoseAccessToken` signs HS256 with `sub = accountId`, `sid = sessionId` and a 15-minute expiry
(`ACCESS_TOKEN_TTL_MS`). It returns `null` for an expired, tampered, `alg: none` or
foreign-secret token.

### Positive Consequences

- No hand-written JWT parsing or signature comparison
- Moving to asymmetric keys (RS256/EdDSA) later only touches the adapter

### Negative Consequences

- `SessionIssuer`, `AuthenticateUseCase`, `FakeAccessToken` and every spec that issues a token
  had to `await` it
- A small async cost on every authenticated request

## Pros and Cons of the Options

### Asynchronous port + `jose` ✅ Chosen

- ✅ Library-grade verification of `alg`, `exp` and required claims
- ✅ Same port works for keys loaded from a remote JWKS later
- ❌ Contract change across the module and its tests

### Synchronous port + `node:crypto`

- ✅ No contract change, no dependency
- ❌ HS256 encoding, constant-time comparison and claim checks written and maintained by hand

## Links

- `NEXT-STEPS.md`, section 0 ("`AccessToken` assíncrono") and section 5
- Commit `d2ab235` (refactor), `dfa37ec` (`JoseAccessToken`)
