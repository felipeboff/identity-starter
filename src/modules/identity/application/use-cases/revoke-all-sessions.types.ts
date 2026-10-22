import { Clock } from "@shared/application/ports/clock";

import { AccessPolicy } from "../policies/access.policy";
import { SessionRevoker } from "../services/session-revoker";

export type RevokeAllSessionsInput = {
  accountId: string;
};

export type RevokeAllSessionsOutput = {
  revokedCount: number;
};

export type RevokeAllSessionsDeps = {
  clock: Clock;

  accessPolicy: AccessPolicy;
  sessionRevoker: SessionRevoker;
};
