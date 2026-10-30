import { Types } from "mongoose";

import { EmailChangeDocument } from "../schemas/email-change.schema";

import { EmailChange } from "@/identity/domain/email-change.entity";

export const emailChangeMapper = {
  toDomain(document: EmailChangeDocument): EmailChange {
    const { _id, accountId, ...rest } = document;
    return EmailChange.restore({
      ...rest,
      id: _id.toHexString(),
      accountId: accountId.toHexString(),
    });
  },

  toDocument(emailChange: EmailChange): EmailChangeDocument {
    const { id, accountId, ...rest } = emailChange.toSnapshot();
    return {
      ...rest,
      _id: new Types.ObjectId(id),
      accountId: new Types.ObjectId(accountId),
    };
  },
};
