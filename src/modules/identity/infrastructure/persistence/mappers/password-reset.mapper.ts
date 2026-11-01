import { Types } from "mongoose";

import { PasswordResetDocument } from "../schemas/password-reset.schema";

import { PasswordReset } from "@/identity/domain/password-reset.entity";

export const passwordResetMapper = {
  toDomain(document: PasswordResetDocument): PasswordReset {
    const { _id, accountId, ...rest } = document;
    return PasswordReset.restore({
      ...rest,
      id: _id.toHexString(),
      accountId: accountId.toHexString(),
    });
  },

  toDocument(passwordReset: PasswordReset): PasswordResetDocument {
    const { id, accountId, ...rest } = passwordReset.toSnapshot();
    return {
      ...rest,
      _id: new Types.ObjectId(id),
      accountId: new Types.ObjectId(accountId),
    };
  },
};
