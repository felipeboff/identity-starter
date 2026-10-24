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

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
