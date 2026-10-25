import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import { OptimisticWriter } from "@shared/infrastructure/mongo/optimistic-writer";

import { IdentityModels } from "./identity-models";
import { emailVerificationMapper } from "./mappers/email-verification.mapper";
import { EmailVerificationDocument } from "./schemas/email-verification.schema";

import { EmailVerificationRepository } from "@/identity/application/ports/email-verification.repository";
import { EmailVerification } from "@/identity/domain/email-verification.entity";

export class MongoEmailVerificationRepository implements EmailVerificationRepository {
  private readonly writer: OptimisticWriter<EmailVerificationDocument>;

  constructor(
    private readonly models: IdentityModels,
    private readonly transactions: TransactionRunner,
  ) {
    this.writer = new OptimisticWriter(models.emailVerifications);
  }

  async save(emailVerification: EmailVerification): Promise<void> {
    await this.writer.save(
      emailVerificationMapper.toDocument(emailVerification),
    );
    this.transactions.afterCommit(() => emailVerification.markAsSaved());
  }

  async findByTokenHash(tokenHash: string): Promise<EmailVerification | null> {
    const document = await this.models.emailVerifications
      .findOne({ tokenHash })
      .lean();
    return document === null
      ? null
      : emailVerificationMapper.toDomain(document);
  }

  async listByAccountId(accountId: string): Promise<EmailVerification[]> {
    const documents = await this.models.emailVerifications
      .find({ accountId })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    return documents.map((document) =>
      emailVerificationMapper.toDomain(document),
    );
  }
}
