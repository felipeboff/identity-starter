import { Clock } from "@shared/application/ports/clock";

import { AccountOutput } from "../mappers/toOutputAccount";
import { AccountRepository } from "../ports/account.repository";
import { AccountResolver } from "../services/account-resolver";

export type UpdateAccountNameInput = {
  name: string;
};

export type UpdateAccountNameOutput = {
  account: AccountOutput;
};

export type UpdateAccountNameDeps = {
  accounts: AccountRepository;
  clock: Clock;

  accountResolver: AccountResolver;
};
