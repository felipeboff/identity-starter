import { AuthProvider, Credential } from "@/identity/domain/credential.entity";

export type CredentialRepository = {
  save(credential: Credential): Promise<void>;
  findById(id: string): Promise<Credential | null>;
  findByEmail(email: string): Promise<Credential | null>;
  findByProviderAndSubject(
    provider: AuthProvider,
    subject: string,
  ): Promise<Credential | null>;
  listByAccountId(accountId: string): Promise<Credential[]>;
};
