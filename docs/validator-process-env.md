# Validator refuses `process.env` as `invalid_object`

- **Found**: 2026-10-24, while writing `src/app/config.ts`
- **Status**: worked around in resolve-hub; validator fix pending in every copy

## Symptom

```ts
v.object({ PORT: v.number() }).parse(process.env);
// { ok: false, violations: [{ field: "", reason: "invalid_object" }] }
```

The variables are set and valid, but `v.object` and `v.record` refuse the whole object. The
same call with `{ ...process.env }` succeeds. It happens in plain Node, not only under Vitest.

## Cause

`isPlainObject` accepts an object only when its prototype is exactly `Object.prototype` or
`null`, so it refuses anything built by a constructor (class instances, `Date`, `Map`...). That
is on purpose: `record.spec.ts` asserts that a class instance is `invalid_object`.

`process.env` is built by a native Node constructor. Its prototype chain is
`process.env -> { constructor: [native function] } -> Object.prototype`, so the check sees it as
a class instance:

```js
Object.getPrototypeOf(process.env) === Object.prototype; // false
Object.prototype.toString.call(process.env); // "[object Object]"
```

## Where the check lives

| Place                                                                  | Line                      | State                                                                              |
| ---------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------- |
| `vale` (`@felipe.boff/vale`) — `src/internal/helpers.ts`               | `isPlainObject`, line 69  | Affected: any direct `v.object(...).parse(process.env)` fails                      |
| `linkio/backend` — `src/shared/application/validation/schemas.ts`      | `isPlainObject`, line 172 | Not hit today: `config/env.ts` rebuilds the object with `Object.fromEntries` first |
| `resolve-hub` — `src/shared/application/validator/internal/helpers.ts` | `isPlainObject`           | Worked around: `src/app/config.ts` validates `{ ...source }`                       |

Search other projects with `grep -rn "isPlainObject" --include=*.ts`.

## Workaround (no validator change)

Copy the host object into a plain one before validating:

```ts
envSchema.probe({ ...process.env });
```

Remove it once the validator is fixed.

## Fix in the validator

Keep refusing class instances and built-ins, and also accept objects whose prototype was made by
a native constructor directly over `Object.prototype` (the shape of `process.env`):

```ts
const NATIVE_CODE = /\{\s*\[native code\]\s*\}$/;

const isNativeConstructor = (fn: unknown): boolean =>
  typeof fn === "function" &&
  NATIVE_CODE.test(Function.prototype.toString.call(fn));

/** A key-value object: refuses arrays, built-ins and class instances; accepts host objects such as `process.env`. */
export const isPlainObject = (
  input: unknown,
): input is Record<string, unknown> => {
  if (Object.prototype.toString.call(input) !== "[object Object]") return false;
  const prototype = Object.getPrototypeOf(input) as object | null;
  if (prototype === Object.prototype || prototype === null) return true;
  return (
    Object.getPrototypeOf(prototype) === Object.prototype &&
    Object.hasOwn(prototype, "constructor") &&
    isNativeConstructor((prototype as { constructor: unknown }).constructor)
  );
};
```

What each step does:

1. `Object.prototype.toString` refuses arrays, `null`, primitives and built-ins with their own tag
   (`Date`, `Map`, `Set`, `Error`, `RegExp`, `Promise`, `URLSearchParams`...).
2. The prototype check keeps the fast path for literals and `Object.create(null)`.
3. The last check accepts one extra level whose own `constructor` is native code. A user class has
   source code (`class Example {}`), so its instances are still refused.

Checked with Node 24:

| Input                                                                                        | Result   |
| -------------------------------------------------------------------------------------------- | -------- |
| `{}`, `Object.create(null)`, `JSON.parse(...)`                                               | accepted |
| `process.env`                                                                                | accepted |
| `new (class Example {})()`, class with methods                                               | refused  |
| `Object.create({})`                                                                          | refused  |
| `Date`, `Map`, `Set`, `Error`, `RegExp`, `Promise`, `URLSearchParams`, array, `null`, string | refused  |

### Tests to add with the fix

In the `isPlainObject` spec (and in `object`/`record` specs if they list accepted inputs):

```ts
it.each([
  // ...existing cases
  ["process.env", process.env],
])("accepts %s", (_, input) => {
  expect(isPlainObject(input)).toBe(true);
});

it.each([
  // ...existing cases
  ["a class instance", new (class Example {})()],
  ["an object over a plain prototype", Object.create({}) as object],
])("rejects %s", (_, input) => {
  expect(isPlainObject(input)).toBe(false);
});
```

Keep the existing `record` case `"a class instance"`: it must still fail.

### After the fix

- resolve-hub: in `src/app/config.ts`, change `envSchema.probe({ ...source })` back to
  `envSchema.probe(source)` and drop its comment.
- vale: release a patch version and note it in the changelog.
- linkio: no call site depends on it; update the copy so it matches `vale`.
