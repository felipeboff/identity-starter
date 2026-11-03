# ADR-014: Send E-mail from a Notifications Module Behind a Shared Port

- **Date**: 2026-11-02
- **Status**: Accepted
- **Deciders**: Felipe Boff
- **Tags**: modules, integration, e-mail, events

## Context and Problem Statement

Only identity could send e-mail: the MailerSend adapter and the log mailer lived inside it. The
"your e-mail was changed" notice left after the commit, with no retry, so a MailerSend outage at
that moment lost a security notice. Nobody got a welcome e-mail, although identity already
published `identity.account.registered` ([ADR-013](013-publish-events-between-modules-on-rabbitmq-from-the-outbox.md))
for anyone to listen to.

## Decision Drivers

- A module announces facts and does not know who reacts to them
- One MailerSend adapter per process, whoever sends
- A notice survives a provider outage of minutes
- E-mails with a token never travel in an event

## Considered Options

- A `notifications` module that reacts to events, with the adapter, behind a `MailSender` port in
  shared
- The same module, with the port in its `public.ts`
- A MailerSend adapter in each module that sends e-mail
- Welcome and notices sent by identity itself

## Decision Outcome

Chosen option: **a `notifications` module with the adapter, behind a `MailSender` port in
shared**, because identity keeps sending its token e-mails without depending on another module,
and every e-mail goes through one adapter.

- `MailSender.send(email: OutgoingEmail)` lives in `src/shared/application/ports`;
  `MailerSendMailSender` and `LogMailSender` live in `src/modules/notifications/infrastructure`
- `start` creates `notifications` first and hands its `MailSender` to identity
  (`IdentityRuntime.mail`); identity composes its texts and keeps answering
  `identity.email_delivery_failed`
- `notifications` subscribes to `identity.account.registered` (welcome) and
  `identity.email.changed` (notice to the old address, published by `ConfirmEmailChange` in its
  transaction); each subscriber only records an outbox effect in the inbox's transaction, and
  BullMQ sends it with 8 attempts and backoff
- The sending logs are `notifications.email_logged` and `notifications.email_delivery_failed`

### Positive Consequences

- Every account created gets a welcome e-mail, once
- The e-mail changed notice is retried like the other effects
- A new notice is a subscriber in `notifications`, not a change in identity

### Negative Consequences

- The sending logs changed names (`identity.email_*` became `notifications.email_*`)
- The welcome and the verification e-mail leave by different paths, in no set order
- The password reset, verification, invitation and e-mail change e-mails stay in identity: their
  token cannot go in an event

## Pros and Cons of the Options

### Notifications module, port in shared ✅ Chosen

- ✅ Identity does not know `notifications`; one adapter for the whole process
- ❌ The port lives apart from the adapter

### Port in the `notifications` `public.ts`

- ✅ Port and adapter in one place
- ❌ Identity would depend on `notifications` to send its own e-mails

### An adapter per module

- ✅ No wiring between modules
- ❌ Two MailerSend implementations and two configurations to keep alike

### Welcome and notices in identity

- ✅ No new module
- ❌ Identity would know every notice anyone wants to send; the notice would still have no retry

## Links

- Builds on [ADR-013](013-publish-events-between-modules-on-rabbitmq-from-the-outbox.md) and
  [ADR-012](012-run-outbox-effects-and-scheduled-jobs-on-bullmq.md)
- `.specs/features/notifications-emails/plan.md` - the literal shapes (Landing doors 1-5)
