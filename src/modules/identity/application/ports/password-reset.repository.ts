import { PasswordReset } from "@/identity/domain/password-reset.entity";

export type PasswordResetRepository = {
  save(passwordReset: PasswordReset): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<PasswordReset | null>;
  listByAccountId(accountId: string): Promise<PasswordReset[]>;
};
