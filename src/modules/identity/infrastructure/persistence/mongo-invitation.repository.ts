import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import { OptimisticWriter } from "@shared/infrastructure/mongo/optimistic-writer";

import { IdentityModels } from "./identity-models";
import { invitationMapper } from "./mappers/invitation.mapper";
import { InvitationDocument } from "./schemas/invitation.schema";

import { InvitationRepository } from "@/identity/application/ports/invitation.repository";
import { Invitation } from "@/identity/domain/invitation.entity";

const CREATION_ORDER = { createdAt: 1, _id: 1 } as const;

export class MongoInvitationRepository implements InvitationRepository {
  private readonly writer: OptimisticWriter<InvitationDocument>;

  constructor(
    private readonly models: IdentityModels,
    private readonly transactions: TransactionRunner,
  ) {
    this.writer = new OptimisticWriter(models.invitations);
  }

  async save(invitation: Invitation): Promise<void> {
    await this.writer.save(invitationMapper.toDocument(invitation));
    this.transactions.afterCommit(() => invitation.markAsSaved());
  }

  async findById(id: string): Promise<Invitation | null> {
    const document = await this.models.invitations.findById(id).lean();
    return document === null ? null : invitationMapper.toDomain(document);
  }

  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    const document = await this.models.invitations
      .findOne({ tokenHash })
      .lean();
    return document === null ? null : invitationMapper.toDomain(document);
  }

  async listByEmail(email: string): Promise<Invitation[]> {
    const documents = await this.models.invitations
      .find({ email })
      .sort(CREATION_ORDER)
      .lean();
    return documents.map((document) => invitationMapper.toDomain(document));
  }

  async list(): Promise<Invitation[]> {
    const documents = await this.models.invitations
      .find()
      .sort(CREATION_ORDER)
      .lean();
    return documents.map((document) => invitationMapper.toDomain(document));
  }
}
