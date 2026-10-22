import { Clock } from "@shared/application/ports/clock";

import { AccountRepository } from "../ports/account.repository";
import { AccountResolver } from "../services/account-resolver";

import { AccountSnapshot } from "@/identity/domain/account.entity";

export type UpdateAccountNameInput = {
  name: string;
};

export type UpdateAccountNameOutput = {
  account: AccountSnapshot;
};

export type UpdateAccountNameDeps = {
  accounts: AccountRepository;
  clock: Clock;

  accountResolver: AccountResolver;
};
