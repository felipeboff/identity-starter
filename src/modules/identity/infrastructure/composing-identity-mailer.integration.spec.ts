import { faker } from "@faker-js/faker";
import { expectAppError } from "@shared/testing/expect-app-error";
import { FakeMailSender } from "@shared/testing/fake-mail-sender";
import { describe, expect, it, vi } from "vitest";

import type { TokenEmail } from "../application/ports/identity-mailer";

import { ComposingIdentityMailer } from "./composing-identity-mailer";
import { IdentityEmailComposer } from "./identity-email-composer";

import { IdentityError } from "@/identity/domain/errors/identity.error";

const buildTokenEmail = (): TokenEmail => ({
  to: faker.internet.email(),
  name: faker.person.fullName(),
  token: faker.string.alphanumeric(43),
  expiresAt: faker.date.future(),
});

const create = () => {
  const composer = new IdentityEmailComposer({
    appUrl: new URL(`https://${faker.internet.domainName()}`),
    productName: faker.company.name(),
  });
  const sender = new FakeMailSender();
  return {
    mailer: new ComposingIdentityMailer({ composer, sender }),
    composer,
    sender,
  };
};

describe("ComposingIdentityMailer", () => {
  it("sends each identity e-mail through the MailSender as the composer builds it", async () => {
    const { mailer, composer, sender } = create();
    const email = buildTokenEmail();
    const invitation = {
      to: email.to,
      inviterName: faker.person.fullName(),
      token: email.token,
      expiresAt: email.expiresAt,
    };

    await mailer.sendPasswordReset(email);
    await mailer.sendEmailVerification(email);
    await mailer.sendInvitation(invitation);
    await mailer.sendEmailChange(email);

    expect(sender.sent).toStrictEqual([
      composer.passwordReset(email),
      composer.emailVerification(email),
      composer.invitation(invitation),
      composer.emailChange(email),
    ]);
  });

  it("fails with identity.email_delivery_failed when the MailSender rejects", async () => {
    const { mailer, sender } = create();
    vi.spyOn(sender, "send").mockRejectedValueOnce(
      new Error(faker.lorem.sentence()),
    );

    await expectAppError(
      mailer.sendInvitation({
        to: faker.internet.email(),
        inviterName: faker.person.fullName(),
        token: faker.string.alphanumeric(43),
        expiresAt: faker.date.future(),
      }),
      IdentityError.EmailDeliveryFailed,
    );
  });
});
