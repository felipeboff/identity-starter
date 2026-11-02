# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - A check that promises an outcome within a timeout must assert the elapsed time, and every default timeout needs its own check, not only the ones that happen to be easy to name.

- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `timeouts` · harmful: 0
- features: mongo-connection
- evidence: checks.md C18 (round 1) (timeouts)
- last seen: 2026-10-24T23:31:51Z

### L-002 - Write the status in a check from the route the proof actually calls (sign-up answers 201), not from a generic success code.

- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `http-edge` · harmful: 0
- features: mongo-connection
- evidence: checks.md C11 (round 1) (http-edge)
- last seen: 2026-10-24T23:31:51Z

### L-003 - server.close() only closes connections idle at that moment; a graceful shutdown must close keep-alive connections as each in-flight response finishes, and its test must bound the drain well under Node's 5 s keep-alive timeout.

- signal: `gate_fail` · recurrence: 1 feature(s) · scope: `http-shutdown` · harmful: 0
- features: mongo-connection
- evidence: src/shared/infrastructure/http/http-server-shutdown.ts (http-shutdown)
- last seen: 2026-10-24T23:31:51Z

### L-004 - Prove a public error body at the HTTP edge by asserting the whole response, not only through unit tests of the code that builds it

- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `routes` · harmful: 0
- features: typebox-handler
- evidence: verification.md round 1 G1 (C10-C13/C15, identity.routes.e2e.spec.ts:293-299) (routes)
- last seen: 2026-10-31T00:09:33Z

### L-005 - When a check claims every route of a set, cover every member in the table or name each exempt route with its reason

- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `routes` · harmful: 0
- features: typebox-handler
- evidence: verification.md round 1 G2 (C15, identity.routes.e2e.spec.ts:110-172) (routes)
- last seen: 2026-10-31T00:09:33Z

### L-006 - Assert the payload on every branch a check names, including the branch that swaps the error definition

- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `shared` · harmful: 0
- features: typebox-handler
- evidence: verification.md round 1 G3 (C14, schema-parser.spec.ts:182-184) (shared)
- last seen: 2026-10-31T00:09:33Z

### L-007 - When a check claims exactly one stored entry, assert the count, not just the first element of the list

- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: mongo-outbox
- evidence: verification.md F1 - identity.module.integration.spec.ts:221 (C8) (tests)
- last seen: 2026-11-02T13:55:45Z

### L-008 - Prove that no timer runs by asserting the pending timer count, not by advancing fake timers by zero

- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: mongo-outbox
- evidence: verification.md F2 - outbox-relay.spec.ts:300 (C17) (tests)
- last seen: 2026-11-02T13:55:45Z

### L-009 - Pin a value settled during the build in the assertion instead of matching any string

- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `tests` · harmful: 0
- features: mongo-outbox
- evidence: verification.md F3 - outbox-relay.spec.ts:260 (C13) (tests)
- last seen: 2026-11-02T13:55:45Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
