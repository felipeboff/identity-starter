import { Types } from "mongoose";

import { EmailVerificationDocument } from "../schemas/email-verification.schema";

import { EmailVerification } from "@/identity/domain/email-verification.entity";

export const emailVerificationMapper = {
  toDomain(document: EmailVerificationDocument): EmailVerification {
    const { _id, accountId, ...rest } = document;
    return EmailVerification.restore({
      ...rest,
      id: _id.toHexString(),
      accountId: accountId.toHexString(),
    });
  },

  toDocument(emailVerification: EmailVerification): EmailVerificationDocument {
    const { id, accountId, ...rest } = emailVerification.toSnapshot();
    return {
      ...rest,
      _id: new Types.ObjectId(id),
      accountId: new Types.ObjectId(accountId),
    };
  },
};
