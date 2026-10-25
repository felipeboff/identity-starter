import { Types } from "mongoose";

import { SessionDocument } from "../schemas/session.schema";

import { Session } from "@/identity/domain/session.entity";

export const sessionMapper = {
  toDomain(document: SessionDocument): Session {
    const {
      _id,
      accountId,
      credentialId,
      membershipId,
      acceptedByAccountId,
      ...rest
    } = document;
    return Session.restore({
      ...rest,
      id: _id.toHexString(),
      accountId: accountId.toHexString(),
      credentialId: credentialId.toHexString(),
      membershipId: membershipId.toHexString(),
      acceptedByAccountId: acceptedByAccountId?.toHexString() ?? null,
    });
  },

  toDocument(session: Session): SessionDocument {
    const {
      id,
      accountId,
      credentialId,
      membershipId,
      acceptedByAccountId,
      ...rest
    } = session.toSnapshot();
    return {
      ...rest,
      _id: new Types.ObjectId(id),
      accountId: new Types.ObjectId(accountId),
      credentialId: new Types.ObjectId(credentialId),
      membershipId: new Types.ObjectId(membershipId),
      acceptedByAccountId:
        acceptedByAccountId === null
          ? null
          : new Types.ObjectId(acceptedByAccountId),
    };
  },
};
