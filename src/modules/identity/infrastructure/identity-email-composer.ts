import { TokenEmail } from "../application/ports/identity-mailer";

export const IdentityEmailTemplate = {
  PASSWORD_RESET: "password_reset",
  EMAIL_VERIFICATION: "email_verification",
} as const;

export type IdentityEmailTemplate =
  (typeof IdentityEmailTemplate)[keyof typeof IdentityEmailTemplate];

export type IdentityEmail = Readonly<{
  template: IdentityEmailTemplate;
  to: string;
  name: string;
  subject: string;
  text: string;
  link: string;
  expiresAt: Date;
}>;

export type IdentityEmailComposerDeps = Readonly<{
  appUrl: URL;
}>;

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export class IdentityEmailComposer {
  private readonly baseUrl: URL;

  constructor(deps: IdentityEmailComposerDeps) {
    const path = deps.appUrl.pathname;
    this.baseUrl = new URL(path.endsWith("/") ? path : `${path}/`, deps.appUrl);
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

  private link(path: string, token: string): string {
    const url = new URL(path, this.baseUrl);
    url.searchParams.set("token", token);
    return url.toString();
  }
}
