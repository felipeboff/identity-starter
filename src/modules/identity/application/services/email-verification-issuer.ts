import { Clock } from "@shared/application/ports/clock";
import { IdGenerator } from "@shared/application/ports/id-generator";
import { type Outbox, OutboxKind } from "@shared/application/ports/outbox";

import { IdentityOutboxEffect } from "../outbox/identity-outbox-effect";
import { EmailVerificationRepository } from "../ports/email-verification.repository";
import { TokenIssuer } from "../ports/token-issuer";
import { EMAIL_VERIFICATION_TTL_MS } from "../token.policy";

import { Account } from "@/identity/domain/account.entity";
import { EmailVerification } from "@/identity/domain/email-verification.entity";

export type EmailVerificationIssuerDeps = Readonly<{
  emailVerifications: EmailVerificationRepository;
  tokens: TokenIssuer;
  outbox: Outbox;
  clock: Clock;
  ids: IdGenerator;
}>;

export class EmailVerificationIssuer {
  constructor(private readonly deps: EmailVerificationIssuerDeps) {}

  async issue(account: Account): Promise<void> {
    const at = this.deps.clock.now();

    const previous = await this.deps.emailVerifications.listByAccountId(
      account.id.value,
    );
    for (const verification of previous.filter((v) => v.isPending(at))) {
      verification.markAsDeleted(at);
      await this.deps.emailVerifications.save(verification);
    }

    const { token, tokenHash } = this.deps.tokens.issue();
    const expiresAt = new Date(at.getTime() + EMAIL_VERIFICATION_TTL_MS);

    await this.deps.emailVerifications.save(
      EmailVerification.register(
        {
          id: this.deps.ids.next(),
          accountId: account.id.value,
          tokenHash,
          expiresAt,
        },
        at,
      ),
    );

    await this.deps.outbox.publish({
      kind: OutboxKind.EFFECT,
      type: IdentityOutboxEffect.EMAIL_VERIFICATION_EMAIL,
      payload: {
        to: account.email.value,
        name: account.name,
        token,
        expiresAt,
      },
    });
  }
}
