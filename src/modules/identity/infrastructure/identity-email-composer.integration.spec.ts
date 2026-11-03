import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { TokenEmail } from "../application/ports/identity-mailer";

import {
  IdentityEmailComposer,
  IdentityEmailTemplate,
} from "./identity-email-composer";

const buildTokenEmail = (overrides: Partial<TokenEmail> = {}): TokenEmail => ({
  to: faker.internet.email(),
  name: faker.person.fullName(),
  token: faker.string.alphanumeric(43),
  expiresAt: faker.date.future(),
  ...overrides,
});

const buildAppUrl = () => `https://${faker.internet.domainName()}`;

describe("IdentityEmailComposer", () => {
  describe("passwordReset", () => {
    it("addresses the e-mail and links to the reset page with the token", () => {
      const appUrl = buildAppUrl();
      const composer = new IdentityEmailComposer({
        appUrl: new URL(appUrl),
        productName: faker.company.name(),
      });
      const email = buildTokenEmail();

      const composed = composer.passwordReset(email);

      expect(composed).toMatchObject({
        template: IdentityEmailTemplate.PASSWORD_RESET,
        to: email.to,
        name: email.name,
        link: `${appUrl}/reset-password?token=${email.token}`,
        expiresAt: email.expiresAt,
      });
    });

    it("puts the name, the link and the expiry in Brasília time in the text", () => {
      const composer = new IdentityEmailComposer({
        appUrl: new URL(buildAppUrl()),
        productName: faker.company.name(),
      });
      const email = buildTokenEmail({
        expiresAt: new Date("2026-03-10T15:30:00.000Z"),
      });

      const composed = composer.passwordReset(email);

      expect(composed.subject).toBe("Redefinição de senha");
      expect(composed.text).toContain(email.name);
      expect(composed.text).toContain(composed.link);
      expect(composed.text).toContain("10/03/2026, 12:30");
    });
  });

  describe("emailVerification", () => {
    it("addresses the e-mail and links to the verification page with the token", () => {
      const appUrl = buildAppUrl();
      const composer = new IdentityEmailComposer({
        appUrl: new URL(appUrl),
        productName: faker.company.name(),
      });
      const email = buildTokenEmail();

      const composed = composer.emailVerification(email);

      expect(composed).toMatchObject({
        template: IdentityEmailTemplate.EMAIL_VERIFICATION,
        to: email.to,
        name: email.name,
        subject: "Confirme seu e-mail",
        link: `${appUrl}/verify-email?token=${email.token}`,
        expiresAt: email.expiresAt,
      });
      expect(composed.text).toContain(email.name);
      expect(composed.text).toContain(composed.link);
    });
  });

  it("keeps the path of an app URL, with or without a trailing slash", () => {
    const path = faker.lorem.word();
    const appUrl = `${buildAppUrl()}/${path}`;
    const email = buildTokenEmail();

    const links = [appUrl, `${appUrl}/`].map(
      (url) =>
        new IdentityEmailComposer({
          appUrl: new URL(url),
          productName: faker.company.name(),
        }).passwordReset(email).link,
    );

    expect(links).toStrictEqual([
      `${appUrl}/reset-password?token=${email.token}`,
      `${appUrl}/reset-password?token=${email.token}`,
    ]);
  });

  it("encodes the token in the link", () => {
    const appUrl = buildAppUrl();
    const token = `${faker.string.alphanumeric(8)}+/=&`;
    const composer = new IdentityEmailComposer({
      appUrl: new URL(appUrl),
      productName: faker.company.name(),
    });

    const { link } = composer.passwordReset(buildTokenEmail({ token }));

    expect(new URL(String(link)).searchParams.get("token")).toBe(token);
  });

  describe("invitation", () => {
    it("links to the invitation page with the token and names the inviter and the product", () => {
      const appUrl = buildAppUrl();
      const productName = faker.company.name();
      const composer = new IdentityEmailComposer({
        appUrl: new URL(appUrl),
        productName,
      });
      const invitation = {
        to: faker.internet.email(),
        inviterName: faker.person.fullName(),
        token: faker.string.alphanumeric(43),
        expiresAt: faker.date.future(),
      };

      const composed = composer.invitation(invitation);

      expect(composed).toMatchObject({
        template: IdentityEmailTemplate.INVITATION,
        to: invitation.to,
        name: invitation.to,
        subject: `Você foi convidado para o ${productName}`,
        link: `${appUrl}/accept-invitation?token=${invitation.token}`,
        expiresAt: invitation.expiresAt,
      });
      expect(composed.text).toContain(invitation.inviterName);
      expect(composed.text).toContain(productName);
      expect(composed.text).toContain(composed.link);
    });
  });

  describe("emailChange", () => {
    it("links to the confirmation page with the token", () => {
      const appUrl = buildAppUrl();
      const composer = new IdentityEmailComposer({
        appUrl: new URL(appUrl),
        productName: faker.company.name(),
      });
      const email = buildTokenEmail();

      const composed = composer.emailChange(email);

      expect(composed).toMatchObject({
        template: IdentityEmailTemplate.EMAIL_CHANGE,
        to: email.to,
        subject: "Confirme seu novo e-mail",
        link: `${appUrl}/confirm-email-change?token=${email.token}`,
        expiresAt: email.expiresAt,
      });
      expect(composed.text).toContain(composed.link);
    });
  });

  describe("layout and text", () => {
    const expiresAt = new Date("2026-03-10T15:30:00.000Z");
    const validity = "Vale até 10/03/2026, 12:30 (horário de Brasília)";

    const create = () => {
      const appUrl = buildAppUrl();
      const productName = faker.company.name();
      const composer = new IdentityEmailComposer({
        appUrl: new URL(appUrl),
        productName,
      });
      return { composer, appUrl, productName };
    };

    it("fills the layout of the password reset e-mail", () => {
      const { composer } = create();
      const email = buildTokenEmail({ expiresAt });

      expect(composer.passwordReset(email).layout).toStrictEqual({
        category: "Segurança",
        title: "Crie uma nova senha",
        paragraphs: [
          `Olá, ${email.name}.`,
          "Recebemos um pedido para redefinir a senha da sua conta.",
        ],
        action: "Criar nova senha",
        validity,
        alert: null,
        footnote:
          "Se você não pediu a redefinição, ignore este e-mail. Sua senha continua a mesma.",
      });
    });

    it("fills the layout of the e-mail verification", () => {
      const { composer } = create();
      const email = buildTokenEmail({ expiresAt });

      expect(composer.emailVerification(email).layout).toStrictEqual({
        category: "Sua conta",
        title: "Confirme seu e-mail",
        paragraphs: [
          `Olá, ${email.name}.`,
          "Falta um passo: confirme que este endereço é seu.",
        ],
        action: "Confirmar e-mail",
        validity,
        alert: null,
        footnote: "Se você não criou uma conta, ignore este e-mail.",
      });
    });

    it("fills the layout of the invitation e-mail", () => {
      const { composer, productName } = create();
      const invitation = {
        to: faker.internet.email(),
        inviterName: faker.person.fullName(),
        token: faker.string.alphanumeric(43),
        expiresAt,
      };

      expect(composer.invitation(invitation).layout).toStrictEqual({
        category: "Convite",
        title: `Você foi convidado para o ${productName}`,
        paragraphs: [
          "Olá.",
          `${invitation.inviterName} convidou você para o ${productName}. Crie sua conta para começar.`,
        ],
        action: "Aceitar convite",
        validity,
        alert: null,
        footnote: "Se você não esperava este convite, ignore este e-mail.",
      });
    });

    it("fills the layout of the e-mail change e-mail", () => {
      const { composer } = create();
      const email = buildTokenEmail({ expiresAt });

      expect(composer.emailChange(email).layout).toStrictEqual({
        category: "Segurança",
        title: "Confirme seu novo e-mail",
        paragraphs: [
          `Olá, ${email.name}.`,
          "Para usar este endereço na sua conta, confirme a troca.",
        ],
        action: "Confirmar novo e-mail",
        validity,
        alert: null,
        footnote: "Se você não pediu a troca, ignore este e-mail.",
      });
    });

    it("keeps today's subject and text of each identity e-mail", () => {
      const { composer, appUrl, productName } = create();
      const email = buildTokenEmail({ expiresAt });
      const invitation = {
        to: email.to,
        inviterName: faker.person.fullName(),
        token: email.token,
        expiresAt,
      };
      const date = "10/03/2026, 12:30";

      expect(
        [
          composer.passwordReset(email),
          composer.emailVerification(email),
          composer.invitation(invitation),
          composer.emailChange(email),
        ].map(({ subject, text }) => ({ subject, text })),
      ).toStrictEqual([
        {
          subject: "Redefinição de senha",
          text: [
            `Olá, ${email.name}.`,
            `Para criar uma nova senha, acesse: ${appUrl}/reset-password?token=${email.token}`,
            `O link vale até ${date} (horário de Brasília).`,
            "Se você não pediu a redefinição, ignore este e-mail.",
          ].join("\n\n"),
        },
        {
          subject: "Confirme seu e-mail",
          text: [
            `Olá, ${email.name}.`,
            `Para confirmar seu e-mail, acesse: ${appUrl}/verify-email?token=${email.token}`,
            `O link vale até ${date} (horário de Brasília).`,
            "Se você não criou uma conta, ignore este e-mail.",
          ].join("\n\n"),
        },
        {
          subject: `Você foi convidado para o ${productName}`,
          text: [
            "Olá.",
            `${invitation.inviterName} convidou você para o ${productName}. Para criar sua conta, acesse: ${appUrl}/accept-invitation?token=${email.token}`,
            `O convite vale até ${date} (horário de Brasília).`,
            "Se você não esperava este convite, ignore este e-mail.",
          ].join("\n\n"),
        },
        {
          subject: "Confirme seu novo e-mail",
          text: [
            `Olá, ${email.name}.`,
            `Para usar este endereço na sua conta, acesse: ${appUrl}/confirm-email-change?token=${email.token}`,
            `O link vale até ${date} (horário de Brasília).`,
            "Se você não pediu a troca, ignore este e-mail.",
          ].join("\n\n"),
        },
      ]);
    });
  });
});
