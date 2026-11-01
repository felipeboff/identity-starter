import { PublicCredential } from "../mappers/toPublicCredential";
import { CredentialRepository } from "../ports/credential.repository";

export type ListCredentialsOutput = {
  credentials: PublicCredential[];
};

export type ListCredentialsDeps = {
  credentials: CredentialRepository;
};
