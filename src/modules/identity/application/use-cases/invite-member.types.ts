import { Clock } from "@shared/application/ports/clock";
import { IdGenerator } from "@shared/application/ports/id-generator";
import type { TransactionRunner } from "@shared/application/ports/transaction-runner";

import { InvitationOutput } from "../mappers/toOutputInvitation";
import { AccessPolicy } from "../policies/access.policy";
import { AccountRepository } from "../ports/account.repository";
import { IdentityMailer } from "../ports/identity-mailer";
import { InvitationRepository } from "../ports/invitation.repository";
import { TokenIssuer } from "../ports/token-issuer";
import { AccountResolver } from "../services/account-resolver";

import {
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";

export type InviteMemberInput = {
  email: string;
  role: MembershipRole;
  permissions: MembershipPermission[];
};

export type InviteMemberOutput = {
  invitation: InvitationOutput;
};

export type InviteMemberDeps = {
  transactions: TransactionRunner;
  accounts: AccountRepository;
  invitations: InvitationRepository;

  tokens: TokenIssuer;
  mailer: IdentityMailer;

  clock: Clock;
  ids: IdGenerator;

  accessPolicy: AccessPolicy;
  accountResolver: AccountResolver;
};
