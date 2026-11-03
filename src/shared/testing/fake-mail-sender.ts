import type {
  MailSender,
  OutgoingEmail,
} from "../application/ports/mail-sender";

export class FakeMailSender implements MailSender {
  readonly sent: OutgoingEmail[] = [];

  send(email: OutgoingEmail): Promise<void> {
    this.sent.push(email);
    return Promise.resolve();
  }
}
