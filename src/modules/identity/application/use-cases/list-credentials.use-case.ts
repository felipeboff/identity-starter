import { UseCase } from "@shared/application/use-cases";

import { Actor } from "../actor";
import { toPublicCredential } from "../mappers/toPublicCredential";

import {
  ListCredentialsDeps,
  ListCredentialsOutput,
} from "./list-credentials.types";

export class ListCredentialsUseCase extends UseCase<{
  output: ListCredentialsOutput;
  deps: ListCredentialsDeps;
  actor: Actor;
}> {
  async execute(actor: Actor): Promise<ListCredentialsOutput> {
    const credentials = await this.deps.credentials.listByAccountId(
      actor.accountId,
    );

    return {
      credentials: credentials
        .filter((credential) => !credential.isDeleted())
        .map((credential) => toPublicCredential(credential)),
    };
  }
}
