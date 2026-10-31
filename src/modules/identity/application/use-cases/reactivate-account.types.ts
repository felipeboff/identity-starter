import { Clock } from "@shared/application/ports/clock";

import { AccountRepository } from "../ports/account.repository";

import { AccountSnapshot } from "@/identity/domain/account.entity";

export type ReactivateAccountInput = {
  accountId: string;
};

export type ReactivateAccountOutput = {
  account: AccountSnapshot;
};

export type ReactivateAccountDeps = {
  accounts: AccountRepository;
  clock: Clock;
};
