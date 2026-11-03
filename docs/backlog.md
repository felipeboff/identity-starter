# Backlog

Work the boilerplate knows about and has not done, checked against the code on 2026-11-03. Each
item says why it waits, so it can be picked up without digging. `STACK.md` marks which
technologies are planned; this file says what work is open. Why the code is as it is lives in
[architecture.md](architecture.md).

## Known risks

Real behaviour no test covers. Each one is low probability today, and each one can bite once
there is traffic.

### Messaging

- **A Mongo blip dead-letters events whose handler never ran.** `MessageRunner.run` treats any
  error from `transactions.run`, a failed inbox write or commit included, as a handler failure
  (`src/shared/application/services/message-runner.ts:41-45`). The 5 attempts come milliseconds
  apart, so a short outage sends the event to `<APP_NAME>.dead`.
- **Retry is "republish, then ack", not atomic** (`src/shared/infrastructure/messaging/rabbit-message-consumers.ts:128-130`).
  A crash between the two leaves both copies in the queue, so a failing message can run more than
  5 times and be dead-lettered twice.
- **An unsettled delivery holds a prefetch slot.** When the republish or the `ack` throws,
  `settle` only logs `shared.message_unsettled` (`rabbit-message-consumers.ts:131-138`). The
  message keeps one of the 10 prefetch slots until the channel closes.
- **Two `MessageConsumer`s with the same `handler.name` share one queue**, bound to both events
  and consumed twice. Nothing refuses it (`src/shared/presentation/messaging/message-consumer-adapter.ts:19-26`).
- **`start` leaks on a late failure.** `scheduledJobs.sync()`, `subscribers.start()` and
  `events.ready()` run after `listen` with no cleanup when they fail (`src/app/start.ts:195-215`),
  and `events.ready()` waits for RabbitMQ with no timeout.
- **Event payloads are not typed where they are published.** `Outbox.publish` takes any payload;
  `AccountRegisteredEvent` is exported but no publish site uses it, and `identity.email.changed`
  has no type at all (`confirm-email-change.use-case.ts:71-80`). A publisher that drifts from the
  type still compiles.
- **The outbox accepts any `<a>.<b>` or `<a>.<b>.<c>` type for both kinds**
  (`src/shared/infrastructure/mongo/outbox.schema.ts:4`), although events are
  `<module>.<aggregate>.<action>` and effects `<module>.<effect>`.

### Security

- **Sign-up tells whether an e-mail has an account** (`400 identity.account_email_taken`). Closing
  it needs another flow: always `201`, and an e-mail to the owner who already exists.
- **Anyone can lock the sign-in of an e-mail** for 15 minutes with 5 wrong passwords
  (`rate-limit.policy.ts:17-21`). CAPTCHA or a progressive delay would be a capability of its
  own.
- **The per-e-mail password reset limit is case-sensitive.** It keys on the raw input
  (`request-password-reset.use-case.ts:27-30`), so `Ana@x.com` and `ana@x.com` count apart. The
  sign-in throttle already lower-cases (`sign-in-throttle.ts:35`). The route always answers
  `204`, so it does not enumerate.

### E-mail rendering (Outlook for Windows)

All in `src/modules/notifications/infrastructure/email-html-renderer.ts`, read from a render and
never opened in a real client:

- the banner text is white over a light gradient, and over the flat `#c9b9ff` fallback (1.77:1
  contrast, close to unreadable);
- the card relies on `max-width:560px` with no MSO ghost table, so it may span the whole pane;
- `font-family` is set only on the outer table and the button, and starts with `Inter`, which is
  not loaded; there is no `<!--[if mso]>` override, so text may fall back to Times New Roman;
- the hidden preheader lacks `mso-hide:all`;
- the button padding is on the `<a>`, which Outlook ignores, so only the label is clickable;
- the alert text (`#a66300` on `#fff4dc`) is 4.36:1, below WCAG AA; the front end uses `#7a4800`.

### Tests

- **Flaky e2e:** "sends the welcome e-mail when an account signs up" waits with `vi.waitFor`
  `timeout: 5_000`, the same as the default test timeout (`src/app/start.e2e.spec.ts:578-598`).
  Under coverage it can time out as a test before the wait gives up.
- **The e-mail changed notice has no retry test.** Only the welcome's retry through BullMQ is
  proven (`notifications.module.integration.spec.ts:252`).
- **Nothing proves the image leaves out `web/`'s dependencies.** Dropping
  `--filter identity-starter` from the `Dockerfile` still passes every test.

## Waiting for a need

Left out on purpose; each comes back when its reason stops holding.

### Identity

- **Refresh token in an `HttpOnly` cookie.** Today it travels in the JSON body. `HttpRoute` has
  no success headers yet (see "Transport-neutral handlers").
- **More than one organization** (reach by organization). The boilerplate has a single one.
- **Invitation and e-mail change e-mails through the outbox.** They are still sent inside the
  request and answer `422 identity.email_delivery_failed` when the provider fails.
- **Liveness apart from readiness.** `GET /health` answers both until an orchestrator tells them
  apart.

### Messaging and jobs

- **More identity events** (`password.changed`, `sessions.revoked`, `invitation.accepted`,
  `account.deactivated`/`reactivated`, `membership.changed`). Each comes with its first
  subscriber; publishing with nobody listening is a contract with no use.
- **A version field in the event contract**, with the first incompatible change.
- **A wait between a subscriber's attempts**, when a subscriber calls an unstable external
  service.
- **Reprocessing abandoned effects and draining `<APP_NAME>.dead`.** Today the log and the
  RabbitMQ management UI. A route or script comes when someone operates the system.
- **A queue dashboard (Bull Board).** It is an exposed surface that needs its own authentication.
- **An effect delayed on purpose by a use case.** `nextAttemptAt` already allows it; nothing needs
  it yet.

### E-mail

- An HTML preview with `MAILER=log` (it logs the link only), the mark as a hosted PNG, a dark
  version, languages other than pt-BR, and preferences or unsubscribe once an e-mail is not
  transactional.

### Edge

- **The MCP binding** (`McpTool`, a `/mcp` endpoint) on the same handlers; per-field
  `description` on the schemas comes with it.
- **More schemas** (CPF/CNPJ, `uuid`, `bigint`) when a module needs them. Raising TypeBox's
  8-violation limit only if a real form needs it.

### Resilience and observability

- **OpenTelemetry** metrics and traces to Grafana, and log shipping (Alloy or Promtail to Loki).
- **Circuit breaker and retry budget** on outbound HTTP. Both need real traffic and metrics.
- **Sentry releases and source map upload** (needs a version from CI), tracing and profiling.

### Delivery

- **CI on every change.** `.github/workflows/ci.yml` runs only on `workflow_dispatch`; add `push`
  or `pull_request`, and build and publish the image there.
- **Production infrastructure:** Terraform, reverse proxy, TLS, a production compose, a
  multi-architecture image.
- **A container for `web/`.**

## Decided against

Kept here so they are not proposed again.

- **Hard account deletion, MFA with TOTP and Apple sign-in.** Declined for this boilerplate.
  `AuthProvider.APPLE` still exists (`credential.entity.ts:12`) and the OAuth gateway refuses it.
- **A role as a named set of permissions.** A role is a label; access comes from permissions.
- **Granting a new module's permissions to admins at boot.** Run `pnpm identity:grant-admin`
  again instead.
- **Permission labels from the API.** The API returns codes; labels belong to the front end
  (i18n).
- **An example product module in the code.** Cloners would only have to delete it; the tests
  declare their own.
- **Help-desk features** (tickets, SLA, attachments). The repository is an identity and access
  boilerplate; product domains are what its users add on top.
