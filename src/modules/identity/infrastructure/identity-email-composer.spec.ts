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
      const composer = new IdentityEmailComposer({ appUrl: new URL(appUrl) });
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
      const composer = new IdentityEmailComposer({ appUrl: new URL(appUrl) });
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
        new IdentityEmailComposer({ appUrl: new URL(url) }).passwordReset(email)
          .link,
    );

    expect(links).toStrictEqual([
      `${appUrl}/reset-password?token=${email.token}`,
      `${appUrl}/reset-password?token=${email.token}`,
    ]);
  });

  it("encodes the token in the link", () => {
    const appUrl = buildAppUrl();
    const token = `${faker.string.alphanumeric(8)}+/=&`;
    const composer = new IdentityEmailComposer({ appUrl: new URL(appUrl) });

    const { link } = composer.passwordReset(buildTokenEmail({ token }));

    expect(new URL(link).searchParams.get("token")).toBe(token);
  });
});
