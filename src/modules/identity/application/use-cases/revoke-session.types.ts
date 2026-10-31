import { Clock } from "@shared/application/ports/clock";

import { AccessPolicy } from "../policies/access.policy";
import { SessionRepository } from "../ports/session.repository";
import { SessionRevoker } from "../services/session-revoker";

export type RevokeSessionInput = {
  sessionId: string;
};

export type RevokeSessionDeps = {
  sessions: SessionRepository;
  clock: Clock;

  accessPolicy: AccessPolicy;
  sessionRevoker: SessionRevoker;
};
