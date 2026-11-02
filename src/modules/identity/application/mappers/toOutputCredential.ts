import { AuthProvider, Credential } from "@/identity/domain/credential.entity";

export type CredentialOutput = {
  id: string;
  provider: AuthProvider;
  providerEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const toOutputCredential = (
  credential: Credential,
): CredentialOutput => ({
  id: credential.id.value,
  provider: credential.provider,
  providerEmail: credential.providerEmail?.value ?? null,
  createdAt: credential.createdAt,
  updatedAt: credential.updatedAt,
});
