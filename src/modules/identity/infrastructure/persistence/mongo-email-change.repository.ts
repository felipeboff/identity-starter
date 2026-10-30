import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import { OptimisticWriter } from "@shared/infrastructure/mongo/optimistic-writer";

import { IdentityModels } from "./identity-models";
import { emailChangeMapper } from "./mappers/email-change.mapper";
import { EmailChangeDocument } from "./schemas/email-change.schema";

import { EmailChangeRepository } from "@/identity/application/ports/email-change.repository";
import { EmailChange } from "@/identity/domain/email-change.entity";

export class MongoEmailChangeRepository implements EmailChangeRepository {
  private readonly writer: OptimisticWriter<EmailChangeDocument>;

  constructor(
    private readonly models: IdentityModels,
    private readonly transactions: TransactionRunner,
  ) {
    this.writer = new OptimisticWriter(models.emailChanges);
  }

  async save(emailChange: EmailChange): Promise<void> {
    await this.writer.save(emailChangeMapper.toDocument(emailChange));
    this.transactions.afterCommit(() => emailChange.markAsSaved());
  }

  async findByTokenHash(tokenHash: string): Promise<EmailChange | null> {
    const document = await this.models.emailChanges
      .findOne({ tokenHash })
      .lean();
    return document === null ? null : emailChangeMapper.toDomain(document);
  }

  async listByAccountId(accountId: string): Promise<EmailChange[]> {
    const documents = await this.models.emailChanges
      .find({ accountId })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    return documents.map((document) => emailChangeMapper.toDomain(document));
  }
}
