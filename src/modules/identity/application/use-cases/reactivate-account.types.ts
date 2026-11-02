import { Clock } from "@shared/application/ports/clock";

import { AccountOutput } from "../mappers/toOutputAccount";
import { AccountRepository } from "../ports/account.repository";

export type ReactivateAccountInput = {
  accountId: string;
};

export type ReactivateAccountOutput = {
  account: AccountOutput;
};

export type ReactivateAccountDeps = {
  accounts: AccountRepository;
  clock: Clock;
};
