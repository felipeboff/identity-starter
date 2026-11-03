# HTML e-mails checks

Profile: light
Plan: `.specs/features/html-emails/plan.md`

8 checks in 2 slices · 2 one-way doors · 0 open, of which 0 block

## Checks

### S1 - The HTML part

**C1** - The MailerSend sender posts `{ from, to, subject, text, html }`, with `html` equal to what `EmailHtmlRenderer` renders for that e-mail and `text` unchanged (AC 1, door 2)
Proof: `pnpm exec vitest run src/modules/notifications/infrastructure/mailersend-mail-sender.integration.spec.ts -t "posts the e-mail to MailerSend"`

**C2** - The rendered HTML shows the product name, the category, the title, every paragraph in order, the footnote, the validity, a button whose `href` is the link and whose label is the `action`, and the link written out (AC 2, AC 3, AC 5, door 2)
Proof: `pnpm exec vitest run src/modules/notifications/infrastructure/email-html-renderer.integration.spec.ts -t "renders the layout of an e-mail with a link"`

**C3** - An e-mail with no link renders no button and no written-out link, and an alert renders in its highlighted box (AC 4, AC 5)
Proof: `pnpm exec vitest run src/modules/notifications/infrastructure/email-html-renderer.integration.spec.ts -t "renders no button for an e-mail with no link"`

**C4** - `<`, `>`, `&` and `"` in the product name, the layout's strings and the link come out as `&lt;`, `&gt;`, `&amp;` and `&quot;`, never as markup (AC 6)
Proof: `pnpm exec vitest run src/modules/notifications/infrastructure/email-html-renderer.integration.spec.ts -t "escapes"`

**C5** - With `MAILER=log` the e-mail is logged with `template`, `to`, `link` and `expiresAt` only (AC 7)
Proof: `pnpm exec vitest run src/modules/notifications/infrastructure/log-mail-sender.integration.spec.ts -t "logs the e-mail instead of sending it"`

### S2 - The layout of each e-mail

**C6** - The identity composer fills the layouts of the password reset, e-mail verification, invitation and e-mail change e-mails with the plan's values (category, title, paragraphs, action, validity `Vale até <dd/mm/aaaa, hh:mm> (horário de Brasília)`, no alert, footnote) (AC 8)
Proof: `pnpm exec vitest run src/modules/identity/infrastructure/identity-email-composer.integration.spec.ts -t "layout"`

**C7** - The identity e-mails keep today's subject, link and text (AC 8)
Proof: `pnpm exec vitest run src/modules/identity/infrastructure/identity-email-composer.integration.spec.ts -t "text"`

**C8** - The welcome e-mail and the e-mail changed notice reach the `MailSender` with today's subject, text and link and the plan's layouts (`Sua conta` · `Boas-vindas ao <product>` · button `Entrar`; `Segurança` · `Seu e-mail foi alterado` · alert, no button) (AC 9)
Proof: `pnpm exec vitest run src/modules/notifications/notifications.module.integration.spec.ts -t "sends the welcome e-mail when its effect runs"`
Proof: `pnpm exec vitest run src/modules/notifications/notifications.module.integration.spec.ts -t "sends the e-mail changed notice when its effect runs"`

## Coverage

| Set (size)                   | Member -> proof                                                                                                       | Unproven |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| e-mails with a layout (6)    | password reset C6 · e-mail verification C6 · invitation C6 · e-mail change C6 · welcome C8 · e-mail changed notice C8 | -        |
| layout parts in the HTML (7) | category C2 · title C2 · paragraphs C2 · action C2, C3 · validity C2 · alert C3 · footnote C2                         | -        |
| escaped characters (4)       | `<` C4 · `>` C4 · `&` C4 · `"` C4                                                                                     | -        |
| `MailSender` adapters (2)    | MailerSend C1 · log C5                                                                                                | -        |
| Landing doors (2)            | 1 C6, C8 · 2 C1, C2, C3, C4                                                                                           | -        |

- Claims naming a field, a label or an escaped form: C1, C2, C4, C6, C8 - each has a proof that asserts that value
- No other check claims more than the single case its proof exercises

## Swept

- validation: C4 (every string escaped)
- failure modes: n/a - rendering is a pure function of the e-mail; the sending failures stay as the notifications-emails checks prove them
- idempotency: n/a - rendering the same e-mail twice gives the same HTML, and nothing is stored
- authorization: n/a - no route
- concurrency: n/a - the renderer keeps no state
- data lifecycle: n/a - the layout is built at send time and never stored
- dependency failure: existing - MailerSend failures, proven by the notifications-emails checks
- state transitions: n/a - no state
- observability: C5 (the log keeps its fields; no HTML in the log)

## Handoff

- Existing files touched (the `MailSender` port, both composers and their specs, the MailerSend sender and its spec, the notifications module and its spec, the identity mailer spec, the fake mail sender spec, the readme) ≈ 45 KB / 4 ≈ 11k, plus about 8k of new files (the renderer and its spec) ≈ 19k, under the 150k budget - one builder
- **Boundary:** C1-C8 closed in one builder (uncommitted, awaiting the user's review); `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test:coverage`, `pnpm test:unit:coverage`, `pnpm test:integration:coverage` and `pnpm test:e2e:coverage` (strict route statuses) all exit 0, every coverage run at 100%
- **Settled mid-build:** the user reviewed the look as a published preview of the six e-mails and approved it with the approach ("implemente"), so `plan.md` was written in English with no pt-BR review copy. The validity follows today's date format, `Vale até 10/03/2026, 12:30 (horário de Brasília)`. The HTML opens with a hidden preview line (the paragraphs joined) for the inbox list. When a layout names no action but the e-mail has a link, the HTML shows the written-out link and no button. A shared test builder, `buildOutgoingEmail`, replaces the e-mail literals in the sender specs
- **Abandoned:** escaping through a lookup map with a fallback no input could reach (an uncoverable branch), replaced by four `replaceAll` calls
