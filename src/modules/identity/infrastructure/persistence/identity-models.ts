import type { Connection, Model } from "mongoose";

import { AccountDocument, accountSchema } from "./account.schema";
import { CredentialDocument, credentialSchema } from "./credential.schema";
import {
  EmailVerificationDocument,
  emailVerificationSchema,
} from "./email-verification.schema";
import { MembershipDocument, membershipSchema } from "./membership.schema";
import {
  PasswordResetDocument,
  passwordResetSchema,
} from "./password-reset.schema";
import { SessionDocument, sessionSchema } from "./session.schema";

export class IdentityModels {
  readonly accounts: Model<AccountDocument>;
  readonly credentials: Model<CredentialDocument>;
  readonly memberships: Model<MembershipDocument>;
  readonly sessions: Model<SessionDocument>;
  readonly passwordResets: Model<PasswordResetDocument>;
  readonly emailVerifications: Model<EmailVerificationDocument>;

  constructor(connection: Connection) {
    this.accounts = connection.model<AccountDocument>("Account", accountSchema);
    this.credentials = connection.model<CredentialDocument>(
      "Credential",
      credentialSchema,
    );
    this.memberships = connection.model<MembershipDocument>(
      "Membership",
      membershipSchema,
    );
    this.sessions = connection.model<SessionDocument>("Session", sessionSchema);
    this.passwordResets = connection.model<PasswordResetDocument>(
      "PasswordReset",
      passwordResetSchema,
    );
    this.emailVerifications = connection.model<EmailVerificationDocument>(
      "EmailVerification",
      emailVerificationSchema,
    );
  }
}
