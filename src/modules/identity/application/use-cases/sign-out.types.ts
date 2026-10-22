import { Clock } from "@shared/application/ports/clock";

import { SessionRepository } from "../ports/session.repository";

export type SignOutOutput = void;

export type SignOutDeps = {
  sessions: SessionRepository;
  clock: Clock;
};
