import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import { OptimisticWriter } from "@shared/infrastructure/mongo/optimistic-writer";

import { IdentityModels } from "./identity-models";
import { sessionMapper } from "./mappers/session.mapper";
import { SessionDocument } from "./schemas/session.schema";

import { SessionRepository } from "@/identity/application/ports/session.repository";
import { Session } from "@/identity/domain/session.entity";

export class MongoSessionRepository implements SessionRepository {
  private readonly writer: OptimisticWriter<SessionDocument>;

  constructor(
    private readonly models: IdentityModels,
    private readonly transactions: TransactionRunner,
  ) {
    this.writer = new OptimisticWriter(models.sessions);
  }

  async save(session: Session): Promise<void> {
    await this.writer.save(sessionMapper.toDocument(session));
    this.transactions.afterCommit(() => session.markAsSaved());
  }

  async findById(id: string): Promise<Session | null> {
    const document = await this.models.sessions.findById(id).lean();
    return document === null ? null : sessionMapper.toDomain(document);
  }

  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    const document = await this.models.sessions.findOne({ tokenHash }).lean();
    return document === null ? null : sessionMapper.toDomain(document);
  }

  async listByAccountId(accountId: string): Promise<Session[]> {
    const documents = await this.models.sessions
      .find({ accountId })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    return documents.map((document) => sessionMapper.toDomain(document));
  }
}
