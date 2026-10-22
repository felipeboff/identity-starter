import { InMemoryRepository } from "@shared/testing/in-memory-repository";

import { AccountRepository } from "../ports/account.repository";
import { CredentialRepository } from "../ports/credential.repository";
import { EmailVerificationRepository } from "../ports/email-verification.repository";
import { MembershipRepository } from "../ports/memberships.repository";
import { PasswordResetRepository } from "../ports/password-reset.repository";
import { SessionRepository } from "../ports/session.repository";

import { Account, AccountSnapshot } from "@/identity/domain/account.entity";
import {
  AuthProvider,
  Credential,
  CredentialSnapshot,
} from "@/identity/domain/credential.entity";
import {
  EmailVerification,
  EmailVerificationSnapshot,
} from "@/identity/domain/email-verification.entity";
import {
  Membership,
  MembershipSnapshot,
} from "@/identity/domain/membership.entity";
import {
  PasswordReset,
  PasswordResetSnapshot,
} from "@/identity/domain/password-reset.entity";
import { Session, SessionSnapshot } from "@/identity/domain/session.entity";

export class InMemoryAccountRepository
  extends InMemoryRepository<{ entity: Account; snapshot: AccountSnapshot }>
  implements AccountRepository
{
  protected toSnapshot(account: Account) {
    return account.toSnapshot();
  }

  protected restore(snapshot: AccountSnapshot) {
    return Account.restore(snapshot);
  }

  save(account: Account) {
    const snapshot = this.toSnapshot(account);
    this.snapshots.set(snapshot.id, snapshot);
    return Promise.resolve();
  }

  findById(id: string) {
    const snapshot = this.snapshots.get(id);
    return Promise.resolve(snapshot ? this.restore(snapshot) : null);
  }

  findByEmail(email: string) {
    const found = [...this.snapshots.values()].find(
      (snapshot) => snapshot.email === email.toLowerCase(),
    );
    return Promise.resolve(found ? this.restore(found) : null);
  }
}

export class InMemoryCredentialRepository
  extends InMemoryRepository<{
    entity: Credential;
    snapshot: CredentialSnapshot;
  }>
  implements CredentialRepository
{
  protected toSnapshot(credential: Credential) {
    return credential.toSnapshot();
  }

  protected restore(snapshot: CredentialSnapshot) {
    return Credential.restore(snapshot);
  }

  save(credential: Credential) {
    const snapshot = this.toSnapshot(credential);
    this.snapshots.set(snapshot.id, snapshot);
    return Promise.resolve();
  }

  findById(id: string) {
    const snapshot = this.snapshots.get(id);
    return Promise.resolve(snapshot ? this.restore(snapshot) : null);
  }

  findByEmail(email: string) {
    const found = [...this.snapshots.values()].find(
      (snapshot) =>
        snapshot.provider === AuthProvider.EMAIL &&
        snapshot.subject === email.toLowerCase(),
    );
    return Promise.resolve(found ? this.restore(found) : null);
  }

  findByProviderAndSubject(provider: AuthProvider, subject: string) {
    const found = [...this.snapshots.values()].find(
      (snapshot) =>
        snapshot.provider === provider && snapshot.subject === subject,
    );
    return Promise.resolve(found ? this.restore(found) : null);
  }

  listByAccountId(accountId: string) {
    const matches = [...this.snapshots.values()].filter(
      (snapshot) => snapshot.accountId === accountId,
    );
    return Promise.resolve(matches.map((snapshot) => this.restore(snapshot)));
  }
}

export class InMemoryMembershipRepository
  extends InMemoryRepository<{
    entity: Membership;
    snapshot: MembershipSnapshot;
  }>
  implements MembershipRepository
{
  protected toSnapshot(membership: Membership) {
    return membership.toSnapshot();
  }

  protected restore(snapshot: MembershipSnapshot) {
    return Membership.restore(snapshot);
  }

  save(membership: Membership) {
    const snapshot = this.toSnapshot(membership);
    this.snapshots.set(snapshot.id, snapshot);
    return Promise.resolve();
  }

  findById(id: string) {
    const snapshot = this.snapshots.get(id);
    return Promise.resolve(snapshot ? this.restore(snapshot) : null);
  }

  findByAccountId(accountId: string) {
    const found = [...this.snapshots.values()].find(
      (snapshot) => snapshot.accountId === accountId,
    );
    return Promise.resolve(found ? this.restore(found) : null);
  }
}

export class InMemorySessionRepository
  extends InMemoryRepository<{ entity: Session; snapshot: SessionSnapshot }>
  implements SessionRepository
{
  protected toSnapshot(session: Session) {
    return session.toSnapshot();
  }

  protected restore(snapshot: SessionSnapshot) {
    return Session.restore(snapshot);
  }

  save(session: Session) {
    const snapshot = this.toSnapshot(session);
    this.snapshots.set(snapshot.id, snapshot);
    return Promise.resolve();
  }

  findById(id: string) {
    const snapshot = this.snapshots.get(id);
    return Promise.resolve(snapshot ? this.restore(snapshot) : null);
  }

  findByTokenHash(tokenHash: string) {
    const found = [...this.snapshots.values()].find(
      (snapshot) => snapshot.tokenHash === tokenHash,
    );
    return Promise.resolve(found ? this.restore(found) : null);
  }

  /** The account's current (not revoked) session. */
  findByAccountId(accountId: string) {
    const found = [...this.snapshots.values()].find(
      (snapshot) =>
        snapshot.accountId === accountId && snapshot.revokedAt === null,
    );
    return Promise.resolve(found ? this.restore(found) : null);
  }

  listByAccountId(accountId: string) {
    const matches = [...this.snapshots.values()].filter(
      (snapshot) => snapshot.accountId === accountId,
    );
    return Promise.resolve(matches.map((snapshot) => this.restore(snapshot)));
  }
}

export class InMemoryPasswordResetRepository
  extends InMemoryRepository<{
    entity: PasswordReset;
    snapshot: PasswordResetSnapshot;
  }>
  implements PasswordResetRepository
{
  protected toSnapshot(passwordReset: PasswordReset) {
    return passwordReset.toSnapshot();
  }

  protected restore(snapshot: PasswordResetSnapshot) {
    return PasswordReset.restore(snapshot);
  }

  save(passwordReset: PasswordReset) {
    const snapshot = this.toSnapshot(passwordReset);
    this.snapshots.set(snapshot.id, snapshot);
    return Promise.resolve();
  }

  findByTokenHash(tokenHash: string) {
    const found = [...this.snapshots.values()].find(
      (snapshot) => snapshot.tokenHash === tokenHash,
    );
    return Promise.resolve(found ? this.restore(found) : null);
  }

  listByAccountId(accountId: string) {
    const matches = [...this.snapshots.values()].filter(
      (snapshot) => snapshot.accountId === accountId,
    );
    return Promise.resolve(matches.map((snapshot) => this.restore(snapshot)));
  }
}

export class InMemoryEmailVerificationRepository
  extends InMemoryRepository<{
    entity: EmailVerification;
    snapshot: EmailVerificationSnapshot;
  }>
  implements EmailVerificationRepository
{
  protected toSnapshot(emailVerification: EmailVerification) {
    return emailVerification.toSnapshot();
  }

  protected restore(snapshot: EmailVerificationSnapshot) {
    return EmailVerification.restore(snapshot);
  }

  save(emailVerification: EmailVerification) {
    const snapshot = this.toSnapshot(emailVerification);
    this.snapshots.set(snapshot.id, snapshot);
    return Promise.resolve();
  }

  findByTokenHash(tokenHash: string) {
    const found = [...this.snapshots.values()].find(
      (snapshot) => snapshot.tokenHash === tokenHash,
    );
    return Promise.resolve(found ? this.restore(found) : null);
  }

  listByAccountId(accountId: string) {
    const matches = [...this.snapshots.values()].filter(
      (snapshot) => snapshot.accountId === accountId,
    );
    return Promise.resolve(matches.map((snapshot) => this.restore(snapshot)));
  }
}
