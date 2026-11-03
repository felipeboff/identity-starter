# HTML e-mails

## Problem

Every e-mail the API sends is plain text: a greeting, a sentence with a raw link pasted in it, the
expiry and a footnote. The front end has a visual identity (lilac ground, white rounded card, the
asterisk mark, the violet button), and the e-mails that lead into it share none of it, so a
password reset or an invitation reads like something nobody designed and hides its one action in a
long URL.

No figures. The user asked for "a nicer e-mail following the style of `web/`", reviewed a preview
of the six e-mails in that style and approved it with the approach ("implemente").

When this ships: every e-mail sent through MailerSend carries an HTML part in the front end's style

- the banner with the mark, the product name and the category, a title, the paragraphs, a button
  for the link, the link written out below it, the validity, an alert where there is one and a
  footnote - next to today's plain text, which does not change.

## Flow

Reuses the `MailSender` port and its MailerSend adapter (ADR-014), and the two composers that
already build each e-mail; the plain text stays theirs.

1. `IdentityEmailComposer` (exists, door 1) and `NotificationsEmailComposer` (exists, door 1) - build each e-mail with its `layout`: category, title, paragraphs, action label, validity, alert, footnote
2. `MailSender` port (exists, door 1) - carries the e-mail with its `layout` to the adapter
3. `MailerSendMailSender` (exists, door 2) - renders the HTML from the `layout`, the link and the product name with `EmailHtmlRenderer` (door 2), and posts `html` next to `text`
4. `LogMailSender` (exists) - logs as today; no HTML
5. out: the MailerSend API gets `{ from, to, subject, text, html }`

## Impact

| Front       | What changes                                                                                                                                                                        |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| domain      | existing term: `OutgoingEmail` gains `layout` - what the HTML shows; both composers fill it, only the MailerSend adapter reads it                                                   |
| domain      | new term: e-mail layout - category, title, paragraphs, action label, validity, alert and footnote of an e-mail                                                                      |
| behaviour   | every MailerSend e-mail gets an HTML part; clients that show HTML show it, the others keep showing today's text                                                                     |
| behaviour   | the e-mails gain a title and a button label ("Criar nova senha", "Aceitar convite"...); the plain text, the subjects and the links stay as today                                    |
| ops         | Outlook for desktop ignores the gradient, the shadow and part of the rounding, and shows a flat lilac banner; Gmail strips the inline SVG mark and keeps the product name beside it |
| tests       | the composer specs and the notifications module spec assert the layouts; the MailerSend spec asserts the `html` field                                                               |
| stored data | nothing - the layout is built when the e-mail is sent, never stored                                                                                                                 |
| docs        | readme (the e-mails have an HTML part; where the layout lives)                                                                                                                      |

## Relations

None - no stored-data shape change.

## Surface

None - no route; the e-mails are the surface, reviewed in `Observable` and door 2.

## Landing

| One-way door                           | Literal shape                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Alternative rejected                                                                                                                                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. `OutgoingEmail` gains `layout`      | `src/shared/application/ports/mail-sender.ts`: `EmailLayout = { category: string; title: string; paragraphs: readonly string[]; action: string \| null; validity: string \| null; alert: string \| null; footnote: string }` and `OutgoingEmail = { template; to; name; subject; text; link; expiresAt; layout: EmailLayout }`; `action` is the button label for `link` and is null when `link` is null; every string is plain text, never markup                                                                                     | each composer writing its own HTML: two copies of the layout, and identity cannot reach the renderer that lives with the adapter in `notifications`; the adapter deriving the HTML from `text`: it would have to guess the title, the button and the footnote from prose |
| 2. One HTML layout, in `notifications` | `EmailHtmlRenderer` (`src/modules/notifications/infrastructure`) renders a table layout with inline styles from the front end's tokens (ground `#f3f2ff`, card `#ffffff` with 28px corners, ink `#0e0e1b`, muted `#686880`, violet `#4733ff`, Inter), the gradient banner with the asterisk mark as inline SVG, the product name and the category, the title, the paragraphs, the button and the written-out link, the validity chip, the alert box and the footnote; every string escaped; `MailerSendMailSender` posts it as `html` | a template engine or an e-mail framework (MJML, react-email): a new dependency for six e-mails; the mark as a PNG served by the front end: needs an asset and an absolute URL in every e-mail, left for later                                                            |

- Nothing else in this change is hard to reverse

## Criteria

### S1: The HTML part (P1)

Every e-mail sent through MailerSend carries the front end's look.

**Acceptance Criteria**

1. WHEN the MailerSend sender sends an e-mail THEN the system SHALL post `html` rendered from its `layout` next to today's `text`
2. The HTML SHALL show the product name, the layout's category, title, paragraphs in order and footnote
3. WHERE the e-mail has a link the HTML SHALL show a button with the `action` label pointing to the link, and the link written out below it
4. WHERE the e-mail has no link the HTML SHALL show no button and no written-out link
5. WHERE the layout has a validity the HTML SHALL show it; WHERE it has an alert the HTML SHALL show it in a highlighted box
6. The HTML SHALL escape every string it shows, so `<`, `>`, `&` and `"` in a name or an e-mail never become markup
7. WHERE `MAILER` = `log` the system SHALL log the e-mail as today, with no HTML

**Independent test:** a password reset e-mail rendered by the MailerSend sender carries `html` with
the button "Criar nova senha" pointing to the reset link.

### S2: The layout of each e-mail (P1)

Each e-mail fills its layout with the copy reviewed in the preview.

**Acceptance Criteria**

8. The identity composer SHALL fill the layouts of the password reset, e-mail verification, invitation and e-mail change e-mails with the values in `Observable`, keeping today's subject, text and link
9. The notifications composer SHALL fill the layouts of the welcome e-mail and the e-mail changed notice with the values in `Observable`, keeping today's subject, text and link

**Independent test:** the welcome e-mail sent by `notifications` carries the layout `Sua conta`,
`Boas-vindas ao <product>`, the button `Entrar`.

## Out of scope

| Excluded                                             | Why                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| the mark as an image (PNG) hosted with the front end | needs an asset and an absolute URL; the inline SVG plus the product name is enough for now |
| a dark-mode version of the e-mails                   | e-mail clients handle dark mode in their own ways; the layout keeps light colours          |
| an HTML preview with `MAILER=log`                    | the log keeps the link, which is what development needs                                    |
| other languages                                      | every e-mail today is in pt-BR                                                             |

## Assumptions

| Assumption            | Chosen default                                                 | Rationale                                                                | Confirmed? |
| --------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------- |
| the look              | the preview the user approved                                  | the user approved the preview and the approach ("implemente")            | y          |
| the mark              | inline SVG beside the product name                             | clients that strip SVG still show the name; a hosted PNG is out of scope | n          |
| copy of the new parts | titles, button labels, categories and footnotes of the preview | the user approved the preview                                            | y          |
| validity text         | `Vale até <dd/mm/aaaa, hh:mm> (horário de Brasília)`           | same date format as today's text                                         | n          |

**Open questions:** none - all resolved or logged above.

## Observable

| Surface               | Decision                                   | Landing                                                                                                                                                                                                                                                                                         |
| --------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| password reset e-mail | structure, tone, what the reader does next | AC 8 - `Segurança` · `Crie uma nova senha` · `Olá, <name>.` / `Recebemos um pedido para redefinir a senha da sua conta.` · button `Criar nova senha` · validity · `Se você não pediu a redefinição, ignore este e-mail. Sua senha continua a mesma.`                                            |
| e-mail verification   | structure, tone, what the reader does next | AC 8 - `Sua conta` · `Confirme seu e-mail` · `Olá, <name>.` / `Falta um passo: confirme que este endereço é seu.` · button `Confirmar e-mail` · validity · `Se você não criou uma conta, ignore este e-mail.`                                                                                   |
| invitation e-mail     | structure, tone, what the reader does next | AC 8 - `Convite` · `Você foi convidado para o <product>` · `Olá.` / `<inviter> convidou você para o <product>. Crie sua conta para começar.` · button `Aceitar convite` · validity · `Se você não esperava este convite, ignore este e-mail.`                                                   |
| e-mail change e-mail  | structure, tone, what the reader does next | AC 8 - `Segurança` · `Confirme seu novo e-mail` · `Olá, <name>.` / `Para usar este endereço na sua conta, confirme a troca.` · button `Confirmar novo e-mail` · validity · `Se você não pediu a troca, ignore este e-mail.`                                                                     |
| welcome e-mail        | structure, tone, what the reader does next | AC 9 - `Sua conta` · `Boas-vindas ao <product>` · `Olá, <name>.` / `Sua conta no <product> foi criada.` · button `Entrar` · no validity · `Se você não criou esta conta, fale com o suporte.`                                                                                                   |
| e-mail changed notice | structure, tone, what the reader does next | AC 9 - `Segurança` · `Seu e-mail foi alterado` · `Olá, <name>.` / `O e-mail da sua conta foi alterado para <newEmail>.` · no button · alert `Se não foi você, fale com o suporte imediatamente.` · `Este aviso vai para o endereço antigo, para que você saiba de qualquer troca na sua conta.` |
| every e-mail          | the reader whose client blocks HTML        | AC 1 - today's `text` goes along unchanged                                                                                                                                                                                                                                                      |
| every e-mail          | empty, loading, error states               | n/a - an e-mail is a static document                                                                                                                                                                                                                                                            |

## Sources

- the user's request and approval in this conversation - "a nicer e-mail following the style of `web/`", the preview of the six e-mails, then "implemente"
- `web/src/styles.css` - the tokens the layout copies (ground, card, ink, violet, radii, Inter)
