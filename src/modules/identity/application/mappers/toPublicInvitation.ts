import { Replace } from "@shared/types/replace";

import {
  Invitation,
  InvitationSnapshot,
} from "@/identity/domain/invitation.entity";

export type PublicInvitation = Replace<
  InvitationSnapshot,
  { tokenHash?: never }
>;

export const toPublicInvitation = (
  invitation: Invitation,
): PublicInvitation => {
  const { tokenHash, ...snapshot } = invitation.toSnapshot();
  void tokenHash;
  return snapshot;
};
