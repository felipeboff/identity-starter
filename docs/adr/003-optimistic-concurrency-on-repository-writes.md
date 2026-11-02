# ADR-003: Optimistic Concurrency on Repository Writes

- **Date**: 2026-10-24
- **Status**: Accepted
- **Deciders**: Felipe Boff
- **Tags**: persistence, mongodb, concurrency, api-contract

## Context and Problem Statement

Entities carry a `version`, but repositories only had in-memory implementations and `save`
overwrote whatever was stored. With MongoDB, two requests that load the same entity and save it
(two sign-ins revoking each other's session, a role change racing a deactivation) would end with
the last write silently erasing the first. We had to decide whether the first Mongo repositories
would check the version right away or later.

## Decision Drivers

- No lost updates once the API is reachable by real clients
- One behaviour for every repository, in memory and in Mongo
- A conflict must surface as a known error, not as a `500`

## Considered Options

- Optimistic locking in every repository from the first Mongo implementation
- Last write wins now, add locking later
- Pessimistic locking (a lock field or a transaction around read and write)

## Decision Outcome

Chosen option: **optimistic locking from the start**, through one shared `OptimisticWriter`
(`src/shared/infrastructure/mongo/optimistic-writer.ts`):

- version `0` (never saved): insert with version `1`. A repeated `_id` throws
  `shared.already_exists` (`409`).
- otherwise: `updateOne({ _id, version }, { $set, $inc: { version: 1 } })`. No match throws
  `shared.version_conflict` (`409`) with `{ id, version }`.

After a successful write the repository calls `markAsSaved()`, so the in-memory entity follows
the stored version. The in-memory repositories enforce the same rules, and one contract suite per
port (`application/testing/contracts/`) runs against both implementations.

### Positive Consequences

- Concurrent writes fail loudly instead of erasing each other
- Unique indexes (e-mail, `provider + subject`) and versions share the same error path

### Negative Consequences

- `save` can now throw `shared.version_conflict`; callers that load, change and save must expect
  it (the client retries, or a use case reloads)
- Saving the same entity instance twice needs `markAsSaved()` in between, which every repository
  must remember to call

## Pros and Cons of the Options

### Optimistic locking from the start ✅ Chosen

- ✅ Cheap: one extra filter field, no locks held
- ✅ The contract is settled before callers multiply
- ❌ Conflicts are pushed to callers

### Last write wins, lock later

- ✅ Simpler first repositories
- ❌ Silent data loss until then, and a contract change for every caller later

### Pessimistic locking

- ✅ No conflict errors for callers
- ❌ Needs lock cleanup or transactions (a replica set) for every write; slower under contention

## Links

- `NEXT-STEPS.md` at commit `eccf67d` (removed in `f248595`), section 0 ("Concorrência") and section 4
- Commits `5fc4c41` (`OptimisticWriter`), `be6659c`, `c09b442` (contracts)
