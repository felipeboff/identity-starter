# Notifications e-mails checks

Profile: light
Plan: `.specs/features/notifications-emails/plan.md`

20 checks in 3 slices · 5 one-way doors · 0 open, of which 0 block

## Checks

Grouped by the plan's slices; numbering runs across the whole feature.

### S1 - A welcome for every account created

**C1** - Scheduling a welcome records the effect `notifications.welcome_email` with `to` = the event's `email` and `name` = its `name` inside the running transaction, and a transaction that aborts keeps no effect (AC 1, door 3)
Proof: `pnpm exec vitest run src/modules/notifications/application/use-cases/schedule-welcome-email.use-case.spec.ts -t "records the welcome e-mail effect"`

**C2** - The subscriber `notifications.schedule_welcome_email` listens to `identity.account.registered`, schedules the welcome for each `registeredVia` (`sign_up`, `oauth`, `invitation`), and refuses a payload whose `email` is not an e-mail (AC 2, door 3)
Proof: `pnpm exec vitest run src/modules/notifications/presentation/notifications.messaging.spec.ts -t "welcome"`

**C3** - The same `identity.account.registered` delivered twice to the subscriber leaves one `notifications.welcome_email` effect and one inbox entry, written in the same Mongo transaction (AC 3, door 3)
Proof: `pnpm exec vitest run src/modules/notifications/notifications.module.integration.spec.ts -t "records one welcome e-mail when the event arrives twice"`

**C4** - When the `notifications.welcome_email` effect runs, the `MailSender` gets `{ template: "welcome", to, name, subject: "Boas-vindas ao <product>", text, link: <APP_URL>, expiresAt: null }`, the text being `Olá, <name>.` / `Sua conta no <product> foi criada. Para entrar, acesse: <APP_URL>` / `Se você não criou esta conta, fale com o suporte.` (AC 4)
Proof: `pnpm exec vitest run src/modules/notifications/notifications.module.integration.spec.ts -t "sends the welcome e-mail when its effect runs"`

**C5** - When the `MailSender` rejects the welcome, the effect run answers `retry` and the effect stays pending with its payload, then the next run sends it and marks it processed (AC 5)
Proof: `pnpm exec vitest run src/modules/notifications/notifications.module.integration.spec.ts -t "leaves the welcome e-mail for the next attempt when sending fails"`

**C6** - With the app running and `MAILER=log`, an e-mail sign-up makes `notifications.email_logged` show up with `template` = `welcome` and the account's e-mail (S1 independent test)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "sends the welcome e-mail when an account signs up"`

### S2 - The e-mail changed notice leaves from `notifications`

**C7** - Confirming an e-mail change publishes `identity.email.changed` with `accountId`, `previousEmail`, `newEmail` and `name`, inside the change's transaction (AC 6, door 4)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/confirm-email-change.use-case.spec.ts -t "publishes identity.email.changed"`

**C8** - A confirmation that fails after the e-mail is changed keeps no `identity.email.changed` event, and a confirmation that succeeds sends no e-mail through the `IdentityMailer` (AC 7, AC 8)
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/confirm-email-change.use-case.spec.ts -t "keeps no identity.email.changed when the change fails"`
Proof: `pnpm exec vitest run src/modules/identity/application/use-cases/confirm-email-change.use-case.spec.ts -t "does not send the e-mail changed notice itself"`

**C9** - The subscriber `notifications.schedule_email_changed_notice` listens to `identity.email.changed` and records the effect `notifications.email_changed_notice` with `to` = `previousEmail`, `name` and `newEmail` inside the running transaction (AC 9, door 3)
Proof: `pnpm exec vitest run src/modules/notifications/application/use-cases/schedule-email-changed-notice.use-case.spec.ts -t "records the e-mail changed notice effect"`
Proof: `pnpm exec vitest run src/modules/notifications/presentation/notifications.messaging.spec.ts -t "e-mail changed notice"`

**C10** - When the `notifications.email_changed_notice` effect runs, the `MailSender` gets `{ template: "email_changed", to, name, subject: "Seu e-mail foi alterado", text, link: null, expiresAt: null }`, the text being `Olá, <name>.` / `O e-mail da sua conta foi alterado para <newEmail>.` / `Se não foi você, fale com o suporte imediatamente.` (AC 10)
Proof: `pnpm exec vitest run src/modules/notifications/notifications.module.integration.spec.ts -t "sends the e-mail changed notice when its effect runs"`

**C11** - With the app running and `MAILER=log`, confirming an e-mail change makes `notifications.email_logged` show up with `template` = `email_changed` and the old e-mail (S2 independent test)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "sends the e-mail changed notice when an e-mail change is confirmed"`

**C12** - Identity's `public.ts` exposes the `identity.email.changed` name (AC 6, door 4)
Proof: `pnpm exec vitest run src/modules/identity/public.spec.ts -t "exposes the e-mail changed event"`

### S3 - One e-mail adapter, in `notifications`

**C13** - Identity's password reset, verification, invitation and e-mail change e-mails reach the `MailSender` exactly as `IdentityEmailComposer` builds them: same `template`, subject, text and link (AC 11, door 2)
Proof: `pnpm exec vitest run src/modules/identity/infrastructure/composing-identity-mailer.integration.spec.ts -t "sends each identity e-mail through the MailSender as the composer builds it"`

**C14** - When the `MailSender` rejects, identity's mailer fails with `identity.email_delivery_failed`, and `POST /invitations` and `POST /me/email` answer it with `422` (AC 12)
Proof: `pnpm exec vitest run src/modules/identity/infrastructure/composing-identity-mailer.integration.spec.ts -t "fails with identity.email_delivery_failed when the MailSender rejects"`
Proof: `pnpm exec vitest run src/modules/identity/presentation/invitations.e2e.spec.ts src/modules/identity/presentation/email-change.e2e.spec.ts -t "cannot be delivered"`

**C15** - The log sender logs `info` `notifications.email_logged` with `template`, `to`, `link` and `expiresAt` (ISO or null) and calls nothing else (AC 13, door 5)
Proof: `pnpm exec vitest run src/modules/notifications/infrastructure/log-mail-sender.integration.spec.ts -t "logs the e-mail instead of sending it"`

**C16** - The MailerSend sender posts to `https://api.mailersend.com/v1/email` with the bearer key, the sender and the e-mail; on a status other than `202`, a timeout or a network failure it logs `error` `notifications.email_delivery_failed` with `template`, the failure and the `status` when there is one, and rejects (AC 14, door 5)
Proof: `pnpm exec vitest run src/modules/notifications/infrastructure/mailersend-mail-sender.integration.spec.ts -t "posts the e-mail to MailerSend"`
Proof: `pnpm exec vitest run src/modules/notifications/infrastructure/mailersend-mail-sender.integration.spec.ts -t "logs notifications.email_delivery_failed"`

**C17** - The app creates one `MailSender`, and the e-mails of identity and of `notifications` go out through that same instance (AC 15, door 2)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "sends identity's and notifications' e-mails through one MailSender"`

**C18** - The `notifications` module declares the subscribers of `identity.account.registered` and `identity.email.changed` and the outbox consumers of `notifications.welcome_email` and `notifications.email_changed_notice`, and exposes its `MailSender` (door 1)
Proof: `pnpm exec vitest run src/modules/notifications/notifications.module.integration.spec.ts -t "declares the notifications consumers and its MailSender"`

**C19** - `toNotificationsSettings` groups `APP_URL`, `MAIL_FROM_NAME` as the product and the mailer settings, and `toIdentitySettings` carries no mailer settings (door 1)
Proof: `pnpm exec vitest run src/app/config.spec.ts -t "groups what the notifications module needs"`
Proof: `pnpm exec vitest run src/app/config.spec.ts -t "groups what the identity module needs"`

**C20** - With `MAILER=log`, a password reset request makes `notifications.email_logged` show up with `template` = `password_reset` and a link carrying the token (S3 independent test)
Proof: `pnpm exec vitest run src/app/start.e2e.spec.ts -t "logs identity's e-mails through the notifications sender"`

## Coverage

| Set (size)                                          | Member -> proof                                                                                  | Unproven |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| ways an account is registered (3)                   | `sign_up` C2 · `oauth` C2 · `invitation` C2                                                      | -        |
| notifications e-mails (2)                           | welcome C4, C6 · e-mail changed notice C10, C11                                                  | -        |
| identity e-mails through the `MailSender` (4)       | password reset C13, C20 · e-mail verification C13 · invitation C13, C14 · e-mail change C13, C14 | -        |
| `MailSender` adapters (2)                           | log C15 · MailerSend C16                                                                         | -        |
| MailerSend outcomes (4)                             | `202` C16 · other status C16 · timeout C16 · network C16                                         | -        |
| effect run outcomes for a notification (2)          | processed C4, C5 · retry C5                                                                      | -        |
| startup config: one `MailSender` for both (1 place) | `start` C17                                                                                      | -        |
| Landing doors (5)                                   | 1 C18, C19 · 2 C13, C17 · 3 C1, C2, C3, C9 · 4 C7, C12 · 5 C15, C16                              | -        |

- Claims naming an effect type, a template, a subject, a text, a log event or a field: C1, C4, C7, C9, C10, C13, C15, C16 - each has a proof that asserts that value
- No other check claims more than the single case its proof exercises

## Swept

- validation: C2 (a registered event whose `email` is not an e-mail is refused by the subscriber's schema)
- failure modes: C5 (sending fails, the effect waits), C8 (the change aborts, no event), C14 (identity answers `identity.email_delivery_failed`)
- idempotency: C3 (the same event twice records one effect)
- authorization: n/a - no route; the events and the effects are reached only by the API process
- concurrency: existing - two deliveries at once run once through the inbox (rabbitmq-events C15, C20); no order between the welcome and the verification e-mail, by assumption
- data lifecycle: existing - a processed effect loses its payload and expires in 7 days (bullmq-jobs), an inbox entry in 7 days (rabbitmq-events C20)
- dependency failure: C5 (MailerSend down retries through BullMQ), C16 (timeout and network)
- state transitions: C5 (pending -> retry -> processed)
- observability: C15, C16 (`notifications.email_logged`, `notifications.email_delivery_failed`)

## Handoff

- Existing files touched (identity mailer port, composer and its spec, the two identity mailers and their specs, `ConfirmEmailChange` with types and spec, the fakes with their spec, the two send-e-mail use case specs, identity events, `public.ts` and its spec, identity module and its spec, identity log events, config and its spec, `start` and its e2e spec, `create-server` e2e spec, the identity-http test helper, `grant-admin`, the invitation and e-mail change e2e specs) = 164 503 bytes / 4 ≈ 41k, plus about 35k of new files (the `MailSender` port with a fake, the notifications module: four use cases, two schemas and four handlers, the composer, the mailer, two senders, errors, log events and their specs) ≈ 76k in total, under the 150k budget - one builder
- **Boundary:** C1-C20 closed in one builder (uncommitted, awaiting the user's review); `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test:coverage`, `pnpm test:unit:coverage`, `pnpm test:integration:coverage` and `pnpm test:e2e:coverage` (strict route statuses) all exit 0, every coverage run at 100%
- **Settled mid-build:** the user approved the plan as written ("implemente"). `NotificationsSettings` also carries `externalCallTimeoutMs`, like `IdentitySettings`, for the MailerSend HTTP client (door 1 lists the other three fields). The sender identity type of the old identity mailer, also named `MailSender`, became `MailFrom` to free the name for the port. `ConfirmEmailChange` publishes the event before revoking the sessions, so a revocation failure proves the event is dropped with the transaction (C8). `src/app` may import only a module's `public.ts` and `*.module.ts`, so C17 proves the single sender by the one `FetchHttpClient` instance (each MailerSend sender builds its own) every MailerSend call goes through, with `MAILER=mailersend` and `fetch` stubbed. The C14 proof first named a `delivery` selector and a `/me/invitations` route; the e2e tests are named "cannot be delivered" and the route is `POST /invitations`. Identity's module spec turned its two MailerSend tests into `MailSender` tests (sending and retry); the MailerSend wire tests moved to the notifications sender spec. The `start` e2e that delivers the outbox e-mails now waits for three effects, the welcome included, and reads the templates from `notifications.email_logged`. The notifications composer and mailer have no spec of their own: the module spec asserts every field of both e-mails
- **Abandoned:** spying `LogMailSender` from the `start` e2e for C17 (the module boundary forbids importing a module's infrastructure from `src/app`)
