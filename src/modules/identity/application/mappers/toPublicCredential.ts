import { Replace } from "@shared/types/replace";

import {
  Credential,
  CredentialSnapshot,
} from "@/identity/domain/credential.entity";

export type PublicCredential = Replace<
  CredentialSnapshot,
  { passwordHash?: never }
>;

export const toPublicCredential = (
  credential: Credential,
): PublicCredential => {
  const { passwordHash, ...snapshot } = credential.toSnapshot();
  void passwordHash;
  return snapshot;
};
