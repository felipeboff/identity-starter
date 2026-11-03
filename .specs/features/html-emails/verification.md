# HTML e-mails verification

**Verdict**: PASS
**Profile**: light
**Diff range**: 257030f (HEAD)..working tree (uncommitted: `git diff HEAD` plus the untracked files in `git status --porcelain`), scoped to the files this feature introduced or changed on top of `notifications-emails`
**Round**: 1 - full
**Verifier**: independent sub-agent (author != verifier)

I ran all 8 checks (C1-C8) on the current working tree. Each one has a located assertion, and each passes as written. The findings below are precision gaps in the checks, plus e-mail-client risks that no check covers. None of them contradicts a check, so none of them fails one.

**Steps that do not run under `light`.** Step 1 (binding sources), the `Coverage` recompute, the `Test policy` verdicts and fault injection do not run. `checks.md` has no `Test policy` section.

**Plan values I still read against the code.**

- The Landing door 2 tokens all match `web/src/styles.css`. Details are in finding 3.
- The plan's six `Observable` layouts match the composers word for word:
  - `identity-email-composer.ts:57-69`, `:88-99`, `:118-129`, `:148-159`
  - `notifications-email-composer.ts:35-46`, `:63-75`

**Tree activity during this run, not caused by me.** I ran only read-only git commands, tests, typecheck, lint and format checks.

- **Index.** At 23:19:45 `.git/index` was rewritten: every file of this feature and of `notifications-emails` moved from untracked or unstaged to staged (`A` / `M `).
- **Another feature started.** At 23:20:10-11 another feature, `permission-catalog`, began writing:
  - `src/shared/domain/errors/shared.error.ts` (new `InvalidPermissionCatalog`)
  - a new untracked `src/shared/domain/value-objects/permission-catalog.value-object.ts`
  - `.specs/features/permission-catalog/`
- **No effect on the results.**
  - Every file in this feature's range was last modified at or before 23:15:03, before my first run.
  - Every run below finished by 23:20:05, before the `permission-catalog` code appeared.
  - The results describe this feature's tree. A later gate run would also include the in-progress `permission-catalog` code.

**Files cited** (base names in the tables):

- `src/modules/notifications/infrastructure/mailersend-mail-sender.integration.spec.ts`
- `src/modules/notifications/infrastructure/email-html-renderer.integration.spec.ts`
- `src/modules/notifications/infrastructure/log-mail-sender.integration.spec.ts`
- `src/modules/identity/infrastructure/identity-email-composer.integration.spec.ts`
- `src/modules/notifications/notifications.module.integration.spec.ts`
- `src/shared/testing/fake-mail-sender.spec.ts` (touched by the feature, carries no check)

## Proof runs

**B1, every proof file in one invocation** (23:16:52):

```
pnpm exec vitest run --reporter=verbose <the 6 spec files listed above>
```

- Result: exit 0. 6 files passed, 29 tests passed, 0 failed.
- I ran each file in full, which is a superset of each proof's `-t` filter. Then I matched every filter against the verbose names, describe path included, as Vitest's `-t` does.
- Every test a filter selects appears individually as passed, and no filter matched zero tests.

| Filter                                                                                                      | Tests matched and passed                                                                         |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| C1 `posts the e-mail to MailerSend`                                                                         | 1                                                                                                |
| C2 `renders the layout of an e-mail with a link`                                                            | 1                                                                                                |
| C3 `renders no button for an e-mail with no link`                                                           | 1                                                                                                |
| C4 `escapes`                                                                                                | 1                                                                                                |
| C5 `logs the e-mail instead of sending it`                                                                  | 2 (with link and expiry; with neither)                                                           |
| C6 `layout`                                                                                                 | 5 (the four "fills the layout of ..." tests plus "keeps today's subject and text ...")           |
| C7 `text`                                                                                                   | 6 (the five in `layout and text`, plus "puts the name, the link and the expiry ... in the text") |
| C8 `sends the welcome e-mail when its effect runs` / `sends the e-mail changed notice when its effect runs` | 1 + 1                                                                                            |

**C6 and C7 filters, run exactly as written.** Their match depends on the describe name, so I ran both on the identity spec:

- `-t "text"`: 6 passed, 6 skipped.
- `-t "layout"`: 5 passed, 7 skipped.

**The named tests are new or changed by this feature.**

- **New tests.** The renderer spec is new. In the identity composer spec, the `layout and text` block and its five tests are new: `git diff HEAD` shows them as added.
- **Changed tests.** The MailerSend spec's `posts the e-mail ...` test now asserts `html`. The log spec now builds its e-mail with `buildOutgoingEmail`, which carries a `layout`. The notifications module spec's two `sends ...` tests now assert `layout`.

## Checks

| Check | Claim                                                                                                                                                        | Proof run                                                          | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Result |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| C1    | MailerSend gets `{ from, to, subject, text, html }`, `html` = renderer output, `text` unchanged (AC 1, door 2)                                               | B1, `-t "posts the e-mail to MailerSend"` - 1 passed               | `mailersend-mail-sender.integration.spec.ts:63` - `expect(sent).toStrictEqual([{ ..., body: { from, to: [{ email: email.to, name: email.name }], subject: email.subject, text: email.text, html: renderer.render(email) } }])` (body at `:71-77`, `text` at `:75`, `html` at `:76`). The strict equality fixes the key set to exactly those five. Production wiring: `mailersend-mail-sender.ts:36-43`; renderer built with `settings.productName` at `notifications.module.ts:60-62`. That value is `MAIL_FROM_NAME` (`config.ts:119`), the same as `from.name`, which is what the test's renderer uses (`:29`). | PASS   |
| C2    | HTML shows product name, category, title, paragraphs in order, footnote, validity, button `href` = link with label = `action`, written-out link (AC 2, 3, 5) | B1, `-t "renders the layout of an e-mail with a link"` - 1 passed  | `email-html-renderer.integration.spec.ts`:<br>`:20` `toContain(`>${productName}</td>`)`<br>`:21` category<br>`:22` `>${layout.title}</h1>`<br>`:25-27` second paragraph's index `toBeGreaterThan` the first's<br>`:28-30` `toMatch(new RegExp(`<a href="${email.link}"[^>]*>${layout.action}</a>`))`<br>`:32` `>${email.link}</p>`<br>`:33` `>${layout.validity}</span>`<br>`:34` `>${layout.footnote}</p>`                                                                                                                                                                                                       | PASS   |
| C3    | No link: no button and no written-out link; the alert sits in its highlighted box (AC 4, 5)                                                                  | B1, `-t "renders no button for an e-mail with no link"` - 1 passed | `email-html-renderer.integration.spec.ts`:<br>`:49` `not.toContain("<a ")`<br>`:50` `not.toContain(WRITTEN_LINK_NOTE)`: the note opens the written-out link block, renderer `:118-121`<br>`:51-53` `toMatch(new RegExp(`<p style="[^"]_background:#fff4dc[^"]_">${alert}</p>`))`                                                                                                                                                                                                                                                                                                                                  | PASS   |
| C4    | `<`, `>`, `&`, `"` in product name, layout strings and link become `&lt;`, `&gt;`, `&amp;`, `&quot;` (AC 6)                                                  | B1, `-t "escapes"` - 1 passed                                      | `email-html-renderer.integration.spec.ts`:<br>`:91` `not.toContain("<script>")`<br>`:92` `expect(html.split(escaped).length - 1).toBe(11)`: 11 positions = title, preview line, product name ×2, category, heading, paragraph, alert, action, validity, footnote. `escaped` is built in-test at `:70-74`.<br>`:93-95` href = link with `&` -> `&amp;` and `"` -> `&quot;`                                                                                                                                                                                                                                         | PASS   |
| C5    | `MAILER=log` logs `template`, `to`, `link`, `expiresAt` only (AC 7)                                                                                          | B1, `-t "logs the e-mail instead of sending it"` - 2 passed        | `log-mail-sender.integration.spec.ts:19-30` - `expect(logger.entries).toStrictEqual([{ level: LogLevel.INFO, event: ..., fields: { template, to, link, expiresAt: expiresAt.toISOString() } }])`, with no `html` field. Also `:41-43`, the same four fields as `null` when the e-mail has no link.                                                                                                                                                                                                                                                                                                                | PASS   |
| C6    | Identity composer fills the four layouts with the plan's values, validity `Vale até <dd/mm/aaaa, hh:mm> (horário de Brasília)`, no alert (AC 8)              | B1, `-t "layout"` - 5 passed (exact run: 5 passed)                 | `identity-email-composer.integration.spec.ts`: `toStrictEqual` on `.layout` at:<br>`:187` password reset<br>`:206` e-mail verification<br>`:229` invitation<br>`:247` e-mail change<br>Each is a literal equal to the plan's `Observable` row, with `alert: null`. The validity literal `"Vale até 10/03/2026, 12:30 (horário de Brasília)"` is at `:171`.                                                                                                                                                                                                                                                        | PASS   |
| C7    | Identity e-mails keep today's subject, link and text (AC 8)                                                                                                  | B1, `-t "text"` - 6 passed (exact run: 6 passed)                   | `identity-email-composer.integration.spec.ts:272-316` - `toStrictEqual` on `{ subject, text }` of all four e-mails. Each text embeds the literal link `${appUrl}/<page>?token=${email.token}`. These are byte-identical to `HEAD`: `git diff HEAD` of the composer changes no subject, text or link line. The `link` field itself is asserted at `:37`, `:76`, `:138`, `:162` (ran and passed in B1; not selected by `-t "text"` - see finding 2).                                                                                                                                                                | PASS   |
| C8    | Welcome and e-mail changed notice reach `MailSender` with today's subject, text, link and the plan's layouts (AC 9)                                          | B1, the two `-t` filters - 1 + 1 passed                            | `notifications.module.integration.spec.ts`:<br>`:221` `expect(sent.mock.calls).toStrictEqual([[{ template: "welcome", ..., link, layout: { category: "Sua conta", title: `Boas-vindas ao ${settings.productName}`, ..., action: "Entrar", validity: null, alert: null, footnote: ... } }]])`, layout at `:235-246`<br>`:293` the same for `email_changed`, with `link: null`, `action: null`, `alert: "Se não foi você, fale com o suporte imediatamente."`, layout at `:307-319`<br>Subjects and texts equal `notifications-emails` C4/C10, and the e-mail changed text equals `HEAD`'s identity copy.           | PASS   |

## Swept existing

| Row                                                                                           | Cited constraint                                                          | In the code                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dependency failure: existing - MailerSend failures, proven by the notifications-emails checks | a non-202 status, a network failure and a timeout are logged and rejected | yes. `mailersend-mail-sender.ts:47-59` logs `EmailDeliveryFailed` and throws. The three failure tests (`mailersend-mail-sender.integration.spec.ts:83`, `:109`, `:131`) ran and passed in B1. The feature's `html` field sits in the same request (`:42`), so failure handling is unchanged. |

The rows marked `n/a` are policy the user approved. `validation` (C4) and `observability` (C5) are covered by checks.

## Findings (none contradicts a check)

1. **Precision gap - C4, the link.**
   - The link fixture carries only `&` and `"` (`:77`), so `<` and `>` in a link are never exercised.
   - Only the `href` position is asserted (`:93-95`). The written-out copy of the link (renderer `:120`) has no escaping assertion.
   - Both go through the same `escape` (renderer `:125-131`), so the risk is low. Still, the claim names the link for all four characters.
2. **Precision gap - C7, the proof filter.**
   - The claim says "subject, link and text". `-t "text"` selects only the subject and text assertions.
   - The literal link is inside the asserted text, so the link the reader sees is proven. The `link` field is asserted only by tests the filter skips (`:37`, `:76`, `:138`, `:162`).
   - Those tests ran and passed in B1. The proof line should name them too.
3. **Precision gap - Landing door 2 tokens have no check.**
   - **What no check asserts.** Door 2 names ground `#f3f2ff`, card `#ffffff` with 28px corners, ink `#0e0e1b`, muted `#686880`, violet `#4733ff`, Inter, the gradient banner and the inline SVG mark. No check asserts any of them, though the `Coverage` table credits door 2 to C1-C4. Only the alert box colour (`#fff4dc`, C3) is asserted.
   - **What I read in the code.** Each token matches `styles.css`:
     - ground: `email-html-renderer.ts:11` = `--bg` `:2`
     - card: `:12` = `--surface` `:3`
     - 28px corners: `:62` = `--radius-xl` `:21`
     - ink: `:15` = `--text` `:8`
     - muted: `:16` = `--text-muted` `:9`
     - violet: `:18` = `--primary` `:11`
     - Inter: `:7` = `--font` `:32`
     - the SVG mark: `:35-39`
4. **Precision gap - C3, the button guard.**
   - **What C3 sets.** C3 sets `action: null` together with `link: null` (`:43`).
   - **What goes unproven.** The renderer hides the button for `link === null` (`:101`), but no test shows that guard on its own. Removing it would still pass every test.
   - **Why it is harmless today.** The door 1 invariant ("`action` is null when `link` is null") makes the guard unreachable, and both composers keep that invariant.
5. **Level note - the S1 independent test has no single test behind it.** That test is "a password reset rendered by the MailerSend sender carries `html` with the button 'Criar nova senha' pointing to the reset link". It is proven only by composition:
   - C6 fills `action: "Criar nova senha"`.
   - C2 renders `action` into the button, on faker layouts.
   - C1 posts the renderer's output.

   No test renders a real composed e-mail.

## Risks no check covers (e-mail client rendering)

Read from a sample render of the password reset e-mail (3,971 bytes). I did not open it in a real client.

1. **White banner text on a light background.**
   - **Where.** The product name and the category are `#ffffff` on the banner (renderer `:67-68`).
   - **The fallback.** In clients that drop `background-image` (Outlook for Windows, which the plan accepts as a flat lilac banner), the banner is `#c9b9ff`. White text on it has a contrast ratio of 1.77:1, which is close to unreadable.
   - **With the gradient.** The base stops are `#a9e6ff` (1.36:1) to `#e9ebff` (1.18:1). The front end's `.mesh` keeps a dark `#08087e` stop that the e-mail banner dropped. The category on the right sits over the lightest part.
   - **Plan coverage.** The plan's `ops` row names the flat banner but not this legibility cost.
2. **Outlook for Windows ignores `max-width`.**
   - The card is `width="100%"` with `max-width:560px` (`:61`), and there is no MSO ghost table or fixed `width` attribute.
   - In the Word engine the card likely spans the whole reading pane.
   - The written-out link uses `word-break:break-all` (`:120`), which Outlook does not honour, so a long token URL can also stretch the layout.
3. **Outlook font fallback.**
   - `font-family` is set on the outer table (`:59`) and on the button (`:105`), not on each `p`/`h1`/`td`.
   - The stack also starts with `Inter`, which is not loaded.
   - Outlook for Windows is known to skip both inheritance and the rest of the stack, so it may render the text in Times New Roman. The usual fix is an `<!--[if mso]>` font override.
4. **Hidden preview line.**
   - It uses `display:none;max-height:0;overflow:hidden` (`:58`), without `mso-hide:all`, `opacity:0` or `font-size:0`.
   - Some Outlook desktop versions show it, which repeats the paragraphs above the banner.
5. **Button padding.**
   - The padding is on the `<a>` (`:105`), and the `<td>` has none.
   - Outlook for Windows ignores padding on inline links, so there the violet box hugs the label and the clickable area is only the text.
6. **Alert contrast.** The alert text is `#a66300` on `#fff4dc`: 4.36:1, below WCAG AA (4.5:1) for 14px text. The front end's `.alert-warning` uses `#7a4800` (6.98:1) for the same box. The footer's `#9a9ab0` on `#f3f2ff` is 2.49:1. That matches the front end's "subtle" token, but it is faint.
7. **Copy, minor.** The text "Se o botão não abrir, copie este endereço no navegador:" also shows when a link has no button (the case settled mid-build, renderer `:115-122`). No current e-mail reaches that case.

## Gate

All exits are 0, every coverage run is at 100%, and every run finished before 23:20:05.

| Command                                            | Result                           |
| -------------------------------------------------- | -------------------------------- |
| B1, the 6 proof files                              | 29 passed, 0 failed              |
| `pnpm typecheck`                                   | exit 0                           |
| `pnpm lint`                                        | exit 0                           |
| `pnpm format:check`                                | exit 0                           |
| `pnpm test:coverage`                               | 164 files, 1587 passed, 0 failed |
| `pnpm test:unit:coverage`                          | 104 files, 869 passed            |
| `pnpm test:integration:coverage`                   | 50 files, 482 passed             |
| `pnpm test:e2e:coverage` (`ROUTE_STATUSES=strict`) | 10 files, 236 passed             |

## Lessons

This verification's brief allows writing only this file, so I did not run `scripts/lessons.py` (it writes `.specs/lessons.json`). Candidate lessons for whoever holds the feature to record:

| Signal        | Source         | Lesson                                                                                                                                                                         |
| ------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| precision gap | C7             | A `-t` filter on a describe name selects that block, not the claim. Name every test that carries a field the claim lists.                                                      |
| precision gap | Landing door 2 | A one-way door's literal values (tokens, sizes) need a check that asserts them, or an explicit exemption. Crediting the door to checks that assert other things hides the gap. |
