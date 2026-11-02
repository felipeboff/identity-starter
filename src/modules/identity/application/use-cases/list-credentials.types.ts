import { CredentialOutput } from "../mappers/toOutputCredential";
import { CredentialRepository } from "../ports/credential.repository";

export type ListCredentialsOutput = {
  credentials: CredentialOutput[];
};

export type ListCredentialsDeps = {
  credentials: CredentialRepository;
};
