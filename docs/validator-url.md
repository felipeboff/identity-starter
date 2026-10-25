# Validator gains `v.url`

- **Added**: 2026-10-25, while adding `APP_URL` and the OAuth redirect URIs to `src/app/config.ts`
- **Status**: done in resolve-hub; not yet ported to `vale` or `linkio`

## Why

The validator had formats for e-mail, UUID and ObjectId, but none for URLs. `config.ts` worked
around it with a local helper: `v.string({ trim: true, minLength: 1, refine: [...] })` and
`URL.canParse`. That helper returned a plain string and accepted anything `URL` can parse,
including `javascript:alert(1)` and `mailto:...`, which is not what a link or a redirect URI
should be.

## Usage

`v.url` returns a `URL` instance, the same way `v.date` returns a `Date`.

```ts
v.url(); // Schema<URL>: http or https, required
v.url({ default: new URL("http://localhost:3000") });
v.url({ protocols: ["https"] }); // only https
v.url({ optional: true }); // or nullable, transform, refine...
```

`UrlOptions` is `BaseOptions<URL>` plus `protocols`:

| Option      | Default             | Effect                                                      |
| ----------- | ------------------- | ----------------------------------------------------------- |
| `protocols` | `["http", "https"]` | Accepted schemes, written without the colon                 |
| `default`   | none                | A `URL` used when the value is missing; it is validated too |
| `transform` | none                | Receives and returns a `URL`                                |
| `refine`    | none                | Checks run on the `URL`                                     |

Failure reason: `invalid_url`. It is now a `BuiltInViolationReason`.

## Behaviour

| Input                                       | Result                                   |
| ------------------------------------------- | ---------------------------------------- |
| `"  https://example.com/Path?x=1  "`        | `URL` for `https://example.com/Path?x=1` |
| `new URL("https://example.com")`            | a copy of it (never the same instance)   |
| `"example.com"` (no protocol), `"   "`      | `invalid_url`                            |
| `"javascript:alert(1)"`, `"mailto:a@b.com"` | `invalid_url`                            |
| `"ftp://example.com"`                       | `invalid_url` (unless in `protocols`)    |
| `42`                                        | `invalid_url`                            |
| `undefined`                                 | `required` (or the `default`)            |

Strings are trimmed and parsed with `URL.parse`, which needs Node 22.1 or newer.

### Normalization

A `URL` is normalized by the platform, so its `href` can differ from the text that came in:

| Written                      | `href`                   |
| ---------------------------- | ------------------------ |
| `http://localhost:3000`      | `http://localhost:3000/` |
| `https://Example.COM/cb`     | `https://example.com/cb` |
| `https://example.com:443/cb` | `https://example.com/cb` |

The path keeps its case. This matters wherever the exact text is compared, such as an OAuth
`redirect_uri`, which must match the registered one character by character. Register the
normalized form (with a path, lowercase host, no default port), or keep that value as a string.

## Changes in resolve-hub

| File                                                                              | Change                                                                                          |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/shared/application/validator/schemas/url.ts`                                 | `url` and `UrlOptions`                                                                          |
| `src/shared/application/validator/schemas/url.spec.ts`                            | its tests                                                                                       |
| `src/shared/application/validator/types.ts`                                       | `"invalid_url"` in `BuiltInViolationReason`                                                     |
| `src/shared/application/validator/schemas/index.ts`, `index.ts`                   | export `url` and `UrlOptions`, and add `url` to `v`                                             |
| `src/app/config.ts`                                                               | `APP_URL`, `GITHUB_REDIRECT_URI` and `GOOGLE_REDIRECT_URI` are `URL`s. The local helper is gone |
| `IdentityEmailComposer`, `FetchOAuthGateway`, `createIdentityIntegrationAdapters` | take `URL`. The gateway sends `redirectUri.href`                                                |

## Porting to the other copies

| Place                                                             | What to do                                                                                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vale` (`@felipe.boff/vale`)                                      | Add `url.ts` next to `date.ts`, the reason, the exports and the entry in `v`, then release a minor version (new API) and note it in the changelog |
| `linkio/backend` — `src/shared/application/validation/schemas.ts` | Same change, so the copy matches `vale`                                                                                                           |

Copy `url.spec.ts` along with the code. It covers strings and `URL` instances, the default
protocols, a custom `protocols` list, trimming, the missing-value cases, `transform` and `refine`.
