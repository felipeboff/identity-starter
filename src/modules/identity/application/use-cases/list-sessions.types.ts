import { Clock } from "@shared/application/ports/clock";

import { PublicSession } from "../mappers/toPublicSession";
import { SessionRepository } from "../ports/session.repository";

export type ListSessionsOutput = {
  sessions: PublicSession[];
};

export type ListSessionsDeps = {
  sessions: SessionRepository;
  clock: Clock;
};
