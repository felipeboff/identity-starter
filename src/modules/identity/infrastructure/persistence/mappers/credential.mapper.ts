import { Types } from "mongoose";

import { CredentialDocument } from "../schemas/credential.schema";

import {
  Credential,
  type CredentialRestore,
} from "@/identity/domain/credential.entity";

export const credentialMapper = {
  toDomain(document: CredentialDocument): Credential {
    const { _id, accountId, ...rest } = document;
    return Credential.restore({
      ...rest,
      id: _id.toHexString(),
      accountId: accountId.toHexString(),
    } as CredentialRestore);
  },

  toDocument(credential: Credential): CredentialDocument {
    const { id, accountId, ...rest } = credential.toSnapshot();
    return {
      ...rest,
      _id: new Types.ObjectId(id),
      accountId: new Types.ObjectId(accountId),
    };
  },
};
