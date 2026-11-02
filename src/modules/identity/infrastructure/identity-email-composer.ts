import {
  EmailChangedNotice,
  InvitationEmail,
  TokenEmail,
} from "../application/ports/identity-mailer";

export const IdentityEmailTemplate = {
  PASSWORD_RESET: "password_reset",
  EMAIL_VERIFICATION: "email_verification",
  INVITATION: "invitation",
  EMAIL_CHANGE: "email_change",
  EMAIL_CHANGED: "email_changed",
} as const;

export type IdentityEmailTemplate =
  (typeof IdentityEmailTemplate)[keyof typeof IdentityEmailTemplate];

export type IdentityEmail = Readonly<{
  template: IdentityEmailTemplate;
  to: string;
  name: string;
  subject: string;
  text: string;
  link: string | null;
  expiresAt: Date | null;
}>;

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
    };
  }

  emailChanged(notice: EmailChangedNotice): IdentityEmail {
    return {
      template: IdentityEmailTemplate.EMAIL_CHANGED,
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
    };
  }

  private link(path: string, token: string): string {
    const url = new URL(path, this.baseUrl);
    url.searchParams.set("token", token);
    return url.toString();
  }
}
