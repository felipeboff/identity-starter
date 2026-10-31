import { Clock } from "@shared/application/ports/clock";

import { SessionRepository } from "../ports/session.repository";
import { SessionRevoker } from "../services/session-revoker";

export type SignOutOutput = void;

export type SignOutDeps = {
  sessions: SessionRepository;
  clock: Clock;

  sessionRevoker: SessionRevoker;
};
