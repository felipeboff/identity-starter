import { Types } from "mongoose";

import { AccountDocument } from "../schemas/account.schema";

import { Account } from "@/identity/domain/account.entity";

export const accountMapper = {
  toDomain(document: AccountDocument): Account {
    const { _id, createdBy, ...rest } = document;
    return Account.restore({
      ...rest,
      id: _id.toHexString(),
      createdBy: createdBy.toHexString(),
    });
  },

  toDocument(account: Account): AccountDocument {
    const { id, createdBy, ...rest } = account.toSnapshot();
    return {
      ...rest,
      _id: new Types.ObjectId(id),
      createdBy: new Types.ObjectId(createdBy),
    };
  },
};
