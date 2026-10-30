import { Clock } from "@shared/application/ports/clock";

import { AccessPolicy } from "../policies/access.policy";
import { InvitationRepository } from "../ports/invitation.repository";

export type RevokeInvitationInput = {
  invitationId: string;
};

export type RevokeInvitationDeps = {
  invitations: InvitationRepository;
  clock: Clock;

  accessPolicy: AccessPolicy;
};
