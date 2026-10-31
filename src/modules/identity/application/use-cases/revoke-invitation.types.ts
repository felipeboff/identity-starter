import { Clock } from "@shared/application/ports/clock";

import { InvitationRepository } from "../ports/invitation.repository";

export type RevokeInvitationInput = {
  invitationId: string;
};

export type RevokeInvitationDeps = {
  invitations: InvitationRepository;
  clock: Clock;
};
