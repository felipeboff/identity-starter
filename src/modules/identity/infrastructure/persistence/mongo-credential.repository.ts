import { AppError } from "@shared/domain/errors/app-error";
import { isDuplicateKey } from "@shared/infrastructure/mongo/duplicate-key";
import { OptimisticWriter } from "@shared/infrastructure/mongo/optimistic-writer";

import { IdentityModels } from "./identity-models";
import { credentialMapper } from "./mappers/credential.mapper";
import { CredentialDocument } from "./schemas/credential.schema";

import { CredentialRepository } from "@/identity/application/ports/credential.repository";
import { AuthProvider, Credential } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";

export class MongoCredentialRepository implements CredentialRepository {
  private readonly writer: OptimisticWriter<CredentialDocument>;

  constructor(private readonly models: IdentityModels) {
    this.writer = new OptimisticWriter(models.credentials);
  }

  async save(credential: Credential): Promise<void> {
    const document = credentialMapper.toDocument(credential);
    try {
      await this.writer.save(document);
    } catch (error) {
      if (isDuplicateKey(error, "subject")) {
        throw document.provider === AuthProvider.EMAIL
          ? new AppError(IdentityError.CredentialEmailTaken, {
              email: document.subject,
            })
          : new AppError(IdentityError.OAuthLinkedToAnotherAccount, {
              provider: document.provider,
            });
      }
      throw error;
    }
    credential.markAsSaved();
  }

  async findById(id: string): Promise<Credential | null> {
    const document = await this.models.credentials.findById(id).lean();
    return document === null ? null : credentialMapper.toDomain(document);
  }

  findByEmail(email: string): Promise<Credential | null> {
    return this.findByProviderAndSubject(
      AuthProvider.EMAIL,
      email.toLowerCase(),
    );
  }

  async findByProviderAndSubject(
    provider: AuthProvider,
    subject: string,
  ): Promise<Credential | null> {
    const document = await this.models.credentials
      .findOne({ provider, subject })
      .lean();
    return document === null ? null : credentialMapper.toDomain(document);
  }

  async listByAccountId(accountId: string): Promise<Credential[]> {
    const documents = await this.models.credentials
      .find({ accountId })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    return documents.map((document) => credentialMapper.toDomain(document));
  }
}
