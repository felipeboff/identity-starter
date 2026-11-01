import { Clock } from "@shared/application/ports/clock";

import { AccessPolicy } from "../policies/access.policy";
import { SessionRepository } from "../ports/session.repository";

import { ListedSession } from "./list-sessions.types";

export type ListAccountSessionsInput = {
  accountId: string;
};

export type ListAccountSessionsOutput = {
  sessions: ListedSession[];
};

export type ListAccountSessionsDeps = {
  sessions: SessionRepository;
  clock: Clock;

  accessPolicy: AccessPolicy;
};
