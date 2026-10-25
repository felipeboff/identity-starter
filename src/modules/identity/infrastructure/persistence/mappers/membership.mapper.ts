import { Types } from "mongoose";

import { MembershipDocument } from "../schemas/membership.schema";

import { Membership } from "@/identity/domain/membership.entity";

export const membershipMapper = {
  toDomain(document: MembershipDocument): Membership {
    const { _id, accountId, createdBy, ...rest } = document;
    return Membership.restore({
      ...rest,
      id: _id.toHexString(),
      accountId: accountId.toHexString(),
      createdBy: createdBy.toHexString(),
    });
  },

  toDocument(membership: Membership): MembershipDocument {
    const { id, accountId, createdBy, ...rest } = membership.toSnapshot();
    return {
      ...rest,
      _id: new Types.ObjectId(id),
      accountId: new Types.ObjectId(accountId),
      createdBy: new Types.ObjectId(createdBy),
    };
  },
};
