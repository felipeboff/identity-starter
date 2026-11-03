/** What the HTML part shows; every string is plain text, never markup. */
export type EmailLayout = Readonly<{
  category: string;
  title: string;
  paragraphs: readonly string[];
  /** The button label for the e-mail's link; null when it has no link. */
  action: string | null;
  validity: string | null;
  alert: string | null;
  footnote: string;
}>;

export type OutgoingEmail = Readonly<{
  template: string;
  to: string;
  name: string;
  subject: string;
  text: string;
  link: string | null;
  expiresAt: Date | null;
  layout: EmailLayout;
}>;

export type MailSender = {
  /** Rejects when the e-mail does not go out. */
  send(email: OutgoingEmail): Promise<void>;
};
