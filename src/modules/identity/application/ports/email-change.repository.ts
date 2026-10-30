import { EmailChange } from "@/identity/domain/email-change.entity";

export type EmailChangeRepository = {
  save(emailChange: EmailChange): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<EmailChange | null>;
  listByAccountId(accountId: string): Promise<EmailChange[]>;
};
