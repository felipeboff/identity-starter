import { AppError } from "@shared/domain/errors/app-error";
import { isDuplicateKey } from "@shared/infrastructure/mongo/duplicate-key";
import { OptimisticWriter } from "@shared/infrastructure/mongo/optimistic-writer";

import { IdentityModels } from "./identity-models";
import { accountMapper } from "./mappers/account.mapper";
import { AccountDocument } from "./schemas/account.schema";

import { AccountRepository } from "@/identity/application/ports/account.repository";
import { Account } from "@/identity/domain/account.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";

export class MongoAccountRepository implements AccountRepository {
  private readonly writer: OptimisticWriter<AccountDocument>;

  constructor(private readonly models: IdentityModels) {
    this.writer = new OptimisticWriter(models.accounts);
  }

  async save(account: Account): Promise<void> {
    const document = accountMapper.toDocument(account);
    try {
      await this.writer.save(document);
    } catch (error) {
      if (isDuplicateKey(error, "email")) {
        throw new AppError(IdentityError.AccountEmailTaken, {
          email: document.email,
        });
      }
      throw error;
    }
    account.markAsSaved();
  }

  async findById(id: string): Promise<Account | null> {
    const document = await this.models.accounts.findById(id).lean();
    return document === null ? null : accountMapper.toDomain(document);
  }

  async findByEmail(email: string): Promise<Account | null> {
    const document = await this.models.accounts
      .findOne({ email: email.toLowerCase() })
      .lean();
    return document === null ? null : accountMapper.toDomain(document);
  }
}
