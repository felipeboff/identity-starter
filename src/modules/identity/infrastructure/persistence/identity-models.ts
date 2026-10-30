import type { Connection, Model } from "mongoose";

import { AccountDocument, accountSchema } from "./schemas/account.schema";
import {
  CredentialDocument,
  credentialSchema,
} from "./schemas/credential.schema";
import {
  EmailChangeDocument,
  emailChangeSchema,
} from "./schemas/email-change.schema";
import {
  EmailVerificationDocument,
  emailVerificationSchema,
} from "./schemas/email-verification.schema";
import {
  InvitationDocument,
  invitationSchema,
} from "./schemas/invitation.schema";
import {
  MembershipDocument,
  membershipSchema,
} from "./schemas/membership.schema";
import {
  PasswordResetDocument,
  passwordResetSchema,
} from "./schemas/password-reset.schema";
import { SessionDocument, sessionSchema } from "./schemas/session.schema";

export class IdentityModels {
  readonly accounts: Model<AccountDocument>;
  readonly credentials: Model<CredentialDocument>;
  readonly memberships: Model<MembershipDocument>;
  readonly sessions: Model<SessionDocument>;
  readonly passwordResets: Model<PasswordResetDocument>;
  readonly emailVerifications: Model<EmailVerificationDocument>;
  readonly invitations: Model<InvitationDocument>;
  readonly emailChanges: Model<EmailChangeDocument>;

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
    this.invitations = connection.model<InvitationDocument>(
      "Invitation",
      invitationSchema,
    );
    this.emailChanges = connection.model<EmailChangeDocument>(
      "EmailChange",
      emailChangeSchema,
    );
  }

  async ready(): Promise<void> {
    await Promise.all([
      this.accounts.init(),
      this.credentials.init(),
      this.memberships.init(),
      this.sessions.init(),
      this.passwordResets.init(),
      this.emailVerifications.init(),
      this.invitations.init(),
      this.emailChanges.init(),
    ]);
  }
}
