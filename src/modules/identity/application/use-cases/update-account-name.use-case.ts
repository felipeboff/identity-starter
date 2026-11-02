import { Access, UseCase } from "@shared/application/use-cases";

import { Actor } from "../actor";
import { toOutputAccount } from "../mappers/toOutputAccount";

import {
  UpdateAccountNameDeps,
  UpdateAccountNameInput,
  UpdateAccountNameOutput,
} from "./update-account-name.types";

export class UpdateAccountNameUseCase extends UseCase<{
  input: UpdateAccountNameInput;
  output: UpdateAccountNameOutput;
  deps: UpdateAccountNameDeps;
  actor: Actor;
}> {
  readonly access = Access.MEMBER;

  async execute(
    input: UpdateAccountNameInput,
    actor: Actor,
  ): Promise<UpdateAccountNameOutput> {
    const account = await this.deps.accountResolver.resolveActive(
      actor.accountId,
    );

    account.updateName(input.name, this.deps.clock.now());
    await this.deps.accounts.save(account);

    return { account: toOutputAccount(account) };
  }
}
