import { Inbound } from "@shared/presentation/handler";

export type SessionOrigin = {
  userAgent: string;
  ipAddress: string;
};

export const toSessionOrigin = (inbound: Inbound<unknown>): SessionOrigin => ({
  userAgent: inbound.metadata["user-agent"] ?? "",
  ipAddress: inbound.ip,
});
