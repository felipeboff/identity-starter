import type { PageQuery } from "@shared/application/pagination.policy";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";
import { OptimisticWriter } from "@shared/infrastructure/mongo/optimistic-writer";

import { IdentityModels } from "./identity-models";
import { membershipMapper } from "./mappers/membership.mapper";
import { MembershipDocument } from "./schemas/membership.schema";

import { MembershipRepository } from "@/identity/application/ports/memberships.repository";
import { Membership } from "@/identity/domain/membership.entity";

export class MongoMembershipRepository implements MembershipRepository {
  private readonly writer: OptimisticWriter<MembershipDocument>;

  constructor(
    private readonly models: IdentityModels,
    private readonly transactions: TransactionRunner,
  ) {
    this.writer = new OptimisticWriter(models.memberships);
  }

  async save(membership: Membership): Promise<void> {
    await this.writer.save(membershipMapper.toDocument(membership));
    this.transactions.afterCommit(() => membership.markAsSaved());
  }

  async findById(id: string): Promise<Membership | null> {
    const document = await this.models.memberships.findById(id).lean();
    return document === null ? null : membershipMapper.toDomain(document);
  }

  async findByAccountId(accountId: string): Promise<Membership | null> {
    const document = await this.models.memberships
      .findOne({ accountId })
      .lean();
    return document === null ? null : membershipMapper.toDomain(document);
  }

  async list(query: PageQuery): Promise<Membership[]> {
    const documents = await this.models.memberships
      .find(query.after === null ? {} : { _id: { $gt: query.after } })
      .sort({ _id: 1 })
      .limit(query.limit)
      .lean();
    return documents.map((document) => membershipMapper.toDomain(document));
  }
}
