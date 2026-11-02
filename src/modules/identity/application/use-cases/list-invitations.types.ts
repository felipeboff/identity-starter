import { Clock } from "@shared/application/ports/clock";

import { InvitationOutput } from "../mappers/toOutputInvitation";
import { InvitationRepository } from "../ports/invitation.repository";

export type ListInvitationsOutput = {
  invitations: InvitationOutput[];
};

export type ListInvitationsDeps = {
  invitations: InvitationRepository;
  clock: Clock;
};
