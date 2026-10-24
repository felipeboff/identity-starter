---
name: writing-code
description: How production and config code is written in this repository, starting with comments - none by default, one short line only when it is truly necessary. Use when writing or editing any source, script or config file (`*.ts`, `*.yml`, `*.json`, `*.config.ts`), reviewing a diff, or when the user mentions comments, JSDoc or "explain in the code". Do NOT use for test data and spec structure (use writing-tests) or for commit messages (use git-workflow).
license: MIT
metadata:
  author: resolve-hub
  version: "1.0.0"
---

# Writing code

## Comments: none, unless truly necessary

The default is **no comment**. Names, types and tests carry the meaning; a comment that repeats
them is noise the user has asked, more than once, not to have. This applies to every file:
TypeScript, YAML, JSON, config.

A comment is allowed only when **all three** hold:

1. the code cannot say it - no better name, type, extracted function or test would;
2. without it, a careful reader would plausibly "fix" the code into a bug, or misuse it;
3. it fits in **one short line**.

Cases that pass the bar (the whole list in this repo today):

- why an Express error handler declares four parameters - removing the unused one silently
  turns it into a normal middleware;
- why `HttpServerShutdown` closes idle connections on every response - without it, keep-alive
  connections hold the shutdown open;
- that the year in the `tag:resolve-hub,2026:` problem type is fixed for good;
- why a `catch` is intentionally empty;
- the external source of a magic literal in a test (a FIPS test vector).

Never write:

- JSDoc or `//` that restates the name, signature or the next line;
- a description of what a class, function, option or field is for;
- section headers, banners, or comments grouping lines;
- the rationale of a design decision - it goes in an ADR, the plan or the chat;
- `TODO` / `FIXME`, commented-out code, or notes to the reviewer;
- comments in tests explaining what the test does - the `it` title says it.

When in doubt, leave it out and say it in the chat instead.

`eslint-disable` and `@ts-expect-error` directives are not comments for this rule; keep their
text to the reason in a few words.
