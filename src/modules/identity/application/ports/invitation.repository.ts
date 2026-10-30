import { Invitation } from "@/identity/domain/invitation.entity";

export type InvitationRepository = {
  save(invitation: Invitation): Promise<void>;
  findById(id: string): Promise<Invitation | null>;
  findByTokenHash(tokenHash: string): Promise<Invitation | null>;
  listByEmail(email: string): Promise<Invitation[]>;
  list(): Promise<Invitation[]>;
};
