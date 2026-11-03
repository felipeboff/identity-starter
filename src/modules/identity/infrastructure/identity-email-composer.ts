import type { OutgoingEmail } from "@shared/application/ports/mail-sender";

import {
  InvitationEmail,
  TokenEmail,
} from "../application/ports/identity-mailer";

export const IdentityEmailTemplate = {
  PASSWORD_RESET: "password_reset",
  EMAIL_VERIFICATION: "email_verification",
  INVITATION: "invitation",
  EMAIL_CHANGE: "email_change",
} as const;

export type IdentityEmailTemplate =
  (typeof IdentityEmailTemplate)[keyof typeof IdentityEmailTemplate];

export type IdentityEmail = OutgoingEmail &
  Readonly<{ template: IdentityEmailTemplate }>;

export type IdentityEmailComposerDeps = Readonly<{
  appUrl: URL;
  productName: string;
}>;

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export class IdentityEmailComposer {
  private readonly baseUrl: URL;
  private readonly productName: string;

  constructor(deps: IdentityEmailComposerDeps) {
    const path = deps.appUrl.pathname;
    this.baseUrl = new URL(path.endsWith("/") ? path : `${path}/`, deps.appUrl);
    this.productName = deps.productName;
  }

  passwordReset(email: TokenEmail): IdentityEmail {
    const link = this.link("reset-password", email.token);
    return {
      template: IdentityEmailTemplate.PASSWORD_RESET,
      to: email.to,
      name: email.name,
      subject: "Redefinição de senha",
      text: [
        `Olá, ${email.name}.`,
        `Para criar uma nova senha, acesse: ${link}`,
        `O link vale até ${DATE_FORMAT.format(email.expiresAt)} (horário de Brasília).`,
        "Se você não pediu a redefinição, ignore este e-mail.",
      ].join("\n\n"),
      link,
      expiresAt: email.expiresAt,
      layout: {
        category: "Segurança",
        title: "Crie uma nova senha",
        paragraphs: [
          `Olá, ${email.name}.`,
          "Recebemos um pedido para redefinir a senha da sua conta.",
        ],
        action: "Criar nova senha",
        validity: this.validity(email.expiresAt),
        alert: null,
        footnote:
          "Se você não pediu a redefinição, ignore este e-mail. Sua senha continua a mesma.",
      },
    };
  }

  emailVerification(email: TokenEmail): IdentityEmail {
    const link = this.link("verify-email", email.token);
    return {
      template: IdentityEmailTemplate.EMAIL_VERIFICATION,
      to: email.to,
      name: email.name,
      subject: "Confirme seu e-mail",
      text: [
        `Olá, ${email.name}.`,
        `Para confirmar seu e-mail, acesse: ${link}`,
        `O link vale até ${DATE_FORMAT.format(email.expiresAt)} (horário de Brasília).`,
        "Se você não criou uma conta, ignore este e-mail.",
      ].join("\n\n"),
      link,
      expiresAt: email.expiresAt,
      layout: {
        category: "Sua conta",
        title: "Confirme seu e-mail",
        paragraphs: [
          `Olá, ${email.name}.`,
          "Falta um passo: confirme que este endereço é seu.",
        ],
        action: "Confirmar e-mail",
        validity: this.validity(email.expiresAt),
        alert: null,
        footnote: "Se você não criou uma conta, ignore este e-mail.",
      },
    };
  }

  invitation(email: InvitationEmail): IdentityEmail {
    const link = this.link("accept-invitation", email.token);
    return {
      template: IdentityEmailTemplate.INVITATION,
      to: email.to,
      name: email.to,
      subject: `Você foi convidado para o ${this.productName}`,
      text: [
        "Olá.",
        `${email.inviterName} convidou você para o ${this.productName}. Para criar sua conta, acesse: ${link}`,
        `O convite vale até ${DATE_FORMAT.format(email.expiresAt)} (horário de Brasília).`,
        "Se você não esperava este convite, ignore este e-mail.",
      ].join("\n\n"),
      link,
      expiresAt: email.expiresAt,
      layout: {
        category: "Convite",
        title: `Você foi convidado para o ${this.productName}`,
        paragraphs: [
          "Olá.",
          `${email.inviterName} convidou você para o ${this.productName}. Crie sua conta para começar.`,
        ],
        action: "Aceitar convite",
        validity: this.validity(email.expiresAt),
        alert: null,
        footnote: "Se você não esperava este convite, ignore este e-mail.",
      },
    };
  }

  emailChange(email: TokenEmail): IdentityEmail {
    const link = this.link("confirm-email-change", email.token);
    return {
      template: IdentityEmailTemplate.EMAIL_CHANGE,
      to: email.to,
      name: email.name,
      subject: "Confirme seu novo e-mail",
      text: [
        `Olá, ${email.name}.`,
        `Para usar este endereço na sua conta, acesse: ${link}`,
        `O link vale até ${DATE_FORMAT.format(email.expiresAt)} (horário de Brasília).`,
        "Se você não pediu a troca, ignore este e-mail.",
      ].join("\n\n"),
      link,
      expiresAt: email.expiresAt,
      layout: {
        category: "Segurança",
        title: "Confirme seu novo e-mail",
        paragraphs: [
          `Olá, ${email.name}.`,
          "Para usar este endereço na sua conta, confirme a troca.",
        ],
        action: "Confirmar novo e-mail",
        validity: this.validity(email.expiresAt),
        alert: null,
        footnote: "Se você não pediu a troca, ignore este e-mail.",
      },
    };
  }

  private validity(expiresAt: Date): string {
    return `Vale até ${DATE_FORMAT.format(expiresAt)} (horário de Brasília)`;
  }

  private link(path: string, token: string): string {
    const url = new URL(path, this.baseUrl);
    url.searchParams.set("token", token);
    return url.toString();
  }
}
