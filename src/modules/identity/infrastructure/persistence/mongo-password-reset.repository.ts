import { OptimisticWriter } from "@shared/infrastructure/mongo/optimistic-writer";

import { IdentityModels } from "./identity-models";
import { passwordResetMapper } from "./mappers/password-reset.mapper";
import { PasswordResetDocument } from "./schemas/password-reset.schema";

import { PasswordResetRepository } from "@/identity/application/ports/password-reset.repository";
import { PasswordReset } from "@/identity/domain/password-reset.entity";

export class MongoPasswordResetRepository implements PasswordResetRepository {
  private readonly writer: OptimisticWriter<PasswordResetDocument>;

  constructor(private readonly models: IdentityModels) {
    this.writer = new OptimisticWriter(models.passwordResets);
  }

  async save(passwordReset: PasswordReset): Promise<void> {
    await this.writer.save(passwordResetMapper.toDocument(passwordReset));
    passwordReset.markAsSaved();
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordReset | null> {
    const document = await this.models.passwordResets
      .findOne({ tokenHash })
      .lean();
    return document === null ? null : passwordResetMapper.toDomain(document);
  }

  async listByAccountId(accountId: string): Promise<PasswordReset[]> {
    const documents = await this.models.passwordResets
      .find({ accountId })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    return documents.map((document) => passwordResetMapper.toDomain(document));
  }
}
