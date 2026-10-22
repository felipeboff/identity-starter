import { EmailVerification } from "@/identity/domain/email-verification.entity";

export type EmailVerificationRepository = {
  save(emailVerification: EmailVerification): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<EmailVerification | null>;
  listByAccountId(accountId: string): Promise<EmailVerification[]>;
};
