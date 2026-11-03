import type { MailSender } from "@shared/application/ports/mail-sender";
import { AppError } from "@shared/domain/errors/app-error";

import {
  IdentityMailer,
  InvitationEmail,
  TokenEmail,
} from "../application/ports/identity-mailer";

import {
  IdentityEmail,
  IdentityEmailComposer,
} from "./identity-email-composer";

import { IdentityError } from "@/identity/domain/errors/identity.error";

export type ComposingIdentityMailerDeps = Readonly<{
  composer: IdentityEmailComposer;
  sender: MailSender;
}>;

export class ComposingIdentityMailer implements IdentityMailer {
  constructor(private readonly deps: ComposingIdentityMailerDeps) {}

  sendPasswordReset(email: TokenEmail): Promise<void> {
    return this.send(this.deps.composer.passwordReset(email));
  }

  sendEmailVerification(email: TokenEmail): Promise<void> {
    return this.send(this.deps.composer.emailVerification(email));
  }

  sendInvitation(email: InvitationEmail): Promise<void> {
    return this.send(this.deps.composer.invitation(email));
  }

  sendEmailChange(email: TokenEmail): Promise<void> {
    return this.send(this.deps.composer.emailChange(email));
  }

  private async send(email: IdentityEmail): Promise<void> {
    try {
      await this.deps.sender.send(email);
    } catch {
      throw new AppError(IdentityError.EmailDeliveryFailed);
    }
  }
}
