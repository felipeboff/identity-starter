---
name: git-workflow
description: Branch, commit and pull-request conventions for this repository. Use when the user asks to commit, create a branch, open or update a PR, split work into commits, write a commit message or PR description, or says "commit", "branch", "PR", "pull request", "push". Do NOT use for fixing CI failures (use gh-fix-ci) or addressing review comments (use gh-address-comments).
license: MIT
metadata:
  author: identity-starter
  version: "1.0.0"
---

# Git workflow

Conventions observed in this repository's history plus the hooks that enforce them. Follow
them exactly; the hooks reject what does not fit.

## Rules

1. **Never commit or push without being asked.** "Commit" authorizes a local commit on the
   current branch; "push" and "open a PR" are separate requests.
2. **Never bypass hooks** (`--no-verify`, `HUSKY=0`). If a hook fails, fix the cause.
3. **Never rewrite published history** (`push --force`, `rebase` of pushed commits) unless the
   user explicitly asks for that branch.
4. **Stage by path**, never `git add -A` or `git add .`. Review `git status` and `git diff`
   first; leave unrelated changes and untracked files alone.
5. Commit messages, branch names and PR text are in **English**.

## Branches

- `master` is the default and the integration branch. Work on `master` only when the user is
  already there and asks for a direct commit (the history so far is linear on `master`).
- When the user asks for a branch, name it `<type>/<scope>-<short-kebab-description>`, using
  the same `type` and `scope` the first commit will carry:
  - `feat/identity-invite-member-use-case`
  - `fix/identity-refresh-token-rotation`
  - `chore/eslint-boundaries`
- Branch from an up-to-date `master`. Delete the branch after merge if the user asks.

## Commits

Enforced by commitlint (`@commitlint/config-conventional`) through the husky `commit-msg`
hook; the `pre-commit` hook runs lint-staged, `pnpm typecheck`, `pnpm test:coverage` and
the per-level `test:unit:coverage`, `test:integration:coverage` and `test:e2e:coverage` (100%
each, plus every route × status covered), so a commit takes a while and fails on any red test.

**Format**: `<type>(<scope>)!: <subject>`

- `type`: `feat`, `fix`, `refactor`, `test`, `chore`, `docs`, `perf`, `build`, `ci`.
- `scope`: the module (`identity`, `shared`) or the tool/config touched
  (`eslint`, `vitest`, `husky`, `skills`). Omit only when the change spans the whole repo.
- `!` for a breaking change in a public contract (`public.ts`, shared ports, snapshots).
- `subject`: imperative, lowercase, no trailing period, ≤ 72 characters, says what the
  change does, not how: `add OAuth sign-in, link and unlink use cases`.
- **Body**: the history uses subject-only commits. Add a body only when the subject cannot
  carry the _why_ (a breaking change, a non-obvious decision); wrap at 72 columns.
- **No trailers.** The `commit-msg` hook strips `Co-Authored-By:` lines on purpose; do not add
  them or any other trailer.

**Granularity**: one commit per coherent unit that leaves the tree green: a use case with
its types and spec; an entity with its spec; a config change with the code it required. Do
not mix a refactor with a feature, or formatting with logic. When a task produced several
units, propose the split before committing.

**Procedure**

1. `git status` and `git diff` (staged and unstaged); confirm every change belongs to this
   commit and matches the user's request.
2. `git add <paths>`.
3. `git commit -m "<message>"` (use a heredoc for a body).
4. If the hook fails: read the output, fix (lint, types, tests, message), re-stage, retry. Do
   not amend a commit that is already pushed.
5. Report the commit hash and subject.

## Pull requests

There is no remote yet. When one exists, use `gh`.

- **Before opening**: `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` green locally;
  branch rebased on or merged with `master`; commits already in the format above.
- **Title**: same format as a commit subject, describing the whole branch
  (`feat(identity): add member invitations`). Squash merges will use it.
- **Body** (keep it short; the reviewer reads code, not prose):

  ```markdown
  ## Summary

  - <what changed, one bullet per coherent unit>

  ## Why

  <the need, in one or two sentences; link the ADR or spec when one exists>

  ## Test plan

  - [ ] <command or scenario a reviewer can run>
  ```

- Open as **draft** when the work is not ready for review; mark ready when it is.
- `gh pr create --draft --title "<title>" --body "$(cat <<'EOF' ... EOF)"`; print the URL.
- Addressing review comments: `gh-address-comments`. Failing checks: `gh-fix-ci`.

## When `spec-lean` is active

The build never commits: [`../spec-lean/references/build.md`](../spec-lean/references/build.md)
leaves every change uncommitted for the user to review. Only when the user asks for commits
after that review, split the reviewed changes into coherent commits (code + tests + the
`checks.md` marks of that slice together) and follow the rules above. The PR links
`.specs/features/<feature>/plan.md`.
