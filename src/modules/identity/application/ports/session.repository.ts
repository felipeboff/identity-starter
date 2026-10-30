import { Session } from "@/identity/domain/session.entity";

export type SessionRepository = {
  save(session: Session): Promise<void>;
  findById(id: string): Promise<Session | null>;
  findByTokenHash(tokenHash: string): Promise<Session | null>;
  listByAccountId(accountId: string): Promise<Session[]>;
};
