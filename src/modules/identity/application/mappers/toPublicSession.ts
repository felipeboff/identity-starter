import { Replace } from "@shared/types/replace";

import { Session, SessionSnapshot } from "@/identity/domain/session.entity";

export type PublicSession = Replace<SessionSnapshot, { tokenHash?: never }>;

export const toPublicSession = (session: Session): PublicSession => {
  const { tokenHash, ...snapshot } = session.toSnapshot();
  void tokenHash;
  return snapshot;
};
