import type {
  OutboxKind,
  OutboxMessage,
} from "@shared/application/ports/outbox";

export const IdentityEvent = {
  ACCOUNT_REGISTERED: "identity.account.registered",
} as const;

export type IdentityEvent = (typeof IdentityEvent)[keyof typeof IdentityEvent];

export const AccountRegisteredVia = {
  SIGN_UP: "sign_up",
  OAUTH: "oauth",
  INVITATION: "invitation",
} as const;

export type AccountRegisteredVia =
  (typeof AccountRegisteredVia)[keyof typeof AccountRegisteredVia];

export type AccountRegisteredPayload = Readonly<{
  accountId: string;
  email: string;
  name: string;
  registeredVia: AccountRegisteredVia;
}>;

export type AccountRegisteredEvent = OutboxMessage<
  typeof OutboxKind.EVENT,
  typeof IdentityEvent.ACCOUNT_REGISTERED,
  AccountRegisteredPayload
>;
