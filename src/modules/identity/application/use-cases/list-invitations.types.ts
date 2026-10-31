import { Clock } from "@shared/application/ports/clock";

import { PublicInvitation } from "../mappers/toPublicInvitation";
import { InvitationRepository } from "../ports/invitation.repository";

export type ListInvitationsOutput = {
  invitations: PublicInvitation[];
};

export type ListInvitationsDeps = {
  invitations: InvitationRepository;
  clock: Clock;
};
