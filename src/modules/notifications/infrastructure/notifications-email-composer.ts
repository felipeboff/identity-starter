import type { OutgoingEmail } from "@shared/application/ports/mail-sender";

import type {
  EmailChangedNotice,
  WelcomeEmail,
} from "../application/ports/notifications-mailer";

export const NotificationsEmailTemplate = {
  WELCOME: "welcome",
  EMAIL_CHANGED: "email_changed",
} as const;

export type NotificationsEmailComposerDeps = Readonly<{
  appUrl: URL;
  productName: string;
}>;

export class NotificationsEmailComposer {
  constructor(private readonly deps: NotificationsEmailComposerDeps) {}

  welcome(email: WelcomeEmail): OutgoingEmail {
    const link = this.deps.appUrl.href;
    return {
      template: NotificationsEmailTemplate.WELCOME,
      to: email.to,
      name: email.name,
      subject: `Boas-vindas ao ${this.deps.productName}`,
      text: [
        `Olá, ${email.name}.`,
        `Sua conta no ${this.deps.productName} foi criada. Para entrar, acesse: ${link}`,
        "Se você não criou esta conta, fale com o suporte.",
      ].join("\n\n"),
      link,
      expiresAt: null,
      layout: {
        category: "Sua conta",
        title: `Boas-vindas ao ${this.deps.productName}`,
        paragraphs: [
          `Olá, ${email.name}.`,
          `Sua conta no ${this.deps.productName} foi criada.`,
        ],
        action: "Entrar",
        validity: null,
        alert: null,
        footnote: "Se você não criou esta conta, fale com o suporte.",
      },
    };
  }

  emailChanged(notice: EmailChangedNotice): OutgoingEmail {
    return {
      template: NotificationsEmailTemplate.EMAIL_CHANGED,
      to: notice.to,
      name: notice.name,
      subject: "Seu e-mail foi alterado",
      text: [
        `Olá, ${notice.name}.`,
        `O e-mail da sua conta foi alterado para ${notice.newEmail}.`,
        "Se não foi você, fale com o suporte imediatamente.",
      ].join("\n\n"),
      link: null,
      expiresAt: null,
      layout: {
        category: "Segurança",
        title: "Seu e-mail foi alterado",
        paragraphs: [
          `Olá, ${notice.name}.`,
          `O e-mail da sua conta foi alterado para ${notice.newEmail}.`,
        ],
        action: null,
        validity: null,
        alert: "Se não foi você, fale com o suporte imediatamente.",
        footnote:
          "Este aviso vai para o endereço antigo, para que você saiba de qualquer troca na sua conta.",
      },
    };
  }
}
