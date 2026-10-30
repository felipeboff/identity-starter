import { Types } from "mongoose";

import { InvitationDocument } from "../schemas/invitation.schema";

import { Invitation } from "@/identity/domain/invitation.entity";

export const invitationMapper = {
  toDomain(document: InvitationDocument): Invitation {
    const { _id, createdBy, acceptedByAccountId, ...rest } = document;
    return Invitation.restore({
      ...rest,
      id: _id.toHexString(),
      createdBy: createdBy.toHexString(),
      acceptedByAccountId: acceptedByAccountId?.toHexString() ?? null,
    });
  },

  toDocument(invitation: Invitation): InvitationDocument {
    const { id, createdBy, acceptedByAccountId, ...rest } =
      invitation.toSnapshot();
    return {
      ...rest,
      _id: new Types.ObjectId(id),
      createdBy: new Types.ObjectId(createdBy),
      acceptedByAccountId:
        acceptedByAccountId === null
          ? null
          : new Types.ObjectId(acceptedByAccountId),
    };
  },
};
