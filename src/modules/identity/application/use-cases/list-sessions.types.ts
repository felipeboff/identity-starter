import { Clock } from "@shared/application/ports/clock";

import { SessionOutput } from "../mappers/toOutputSession";
import { SessionRepository } from "../ports/session.repository";

export type ListedSession = SessionOutput & {
  current: boolean;
};

export type ListSessionsOutput = {
  sessions: ListedSession[];
};

export type ListSessionsDeps = {
  sessions: SessionRepository;
  clock: Clock;
};
