import { Clock } from "@shared/application/ports/clock";

import { PublicSession } from "../mappers/toPublicSession";
import { SessionRepository } from "../ports/session.repository";

export type ListedSession = PublicSession & {
  current: boolean;
};

export type ListSessionsOutput = {
  sessions: ListedSession[];
};

export type ListSessionsDeps = {
  sessions: SessionRepository;
  clock: Clock;
};
