import { Session } from "@/identity/domain/session.entity";

export type SessionOutput = {
  id: string;
  userAgent: string;
  ipAddress: string;
  createdAt: Date;
  expiresAt: Date;
};

export const toOutputSession = (session: Session): SessionOutput => ({
  id: session.id.value,
  userAgent: session.userAgent,
  ipAddress: session.ipAddress,
  createdAt: session.createdAt,
  expiresAt: session.expiresAt,
});
