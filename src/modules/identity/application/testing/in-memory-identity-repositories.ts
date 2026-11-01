import type { PageQuery } from "@shared/application/pagination.policy";
import { AppError } from "@shared/domain/errors/app-error";
import { InMemoryRepository } from "@shared/testing/in-memory-repository";

import { AccountRepository } from "../ports/account.repository";
import { CredentialRepository } from "../ports/credential.repository";
import { EmailChangeRepository } from "../ports/email-change.repository";
import { EmailVerificationRepository } from "../ports/email-verification.repository";
import { InvitationRepository } from "../ports/invitation.repository";
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
  EmailChange,
  EmailChangeSnapshot,
} from "@/identity/domain/email-change.entity";
import {
  EmailVerification,
  EmailVerificationSnapshot,
} from "@/identity/domain/email-verification.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import {
  Invitation,
  InvitationSnapshot,
} from "@/identity/domain/invitation.entity";
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
    const { id, email } = account.toSnapshot();
    const taken = [...this.snapshots.values()].some(
      (snapshot) => snapshot.email === email && snapshot.id !== id,
    );
    if (taken) {
      return Promise.reject(
        new AppError(IdentityError.AccountEmailTaken, { email }),
      );
    }
    return this.store(account);
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

  findByIds(ids: readonly string[]) {
    const matches = [...this.snapshots.values()].filter((snapshot) =>
      ids.includes(snapshot.id),
    );
    return Promise.resolve(matches.map((snapshot) => this.restore(snapshot)));
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
    const { id, provider, subject } = credential.toSnapshot();
    const taken = [...this.snapshots.values()].some(
      (snapshot) =>
        snapshot.provider === provider &&
        snapshot.subject === subject &&
        snapshot.id !== id,
    );
    if (taken) {
      return Promise.reject(
        provider === AuthProvider.EMAIL
          ? new AppError(IdentityError.CredentialEmailTaken, { email: subject })
          : new AppError(IdentityError.OAuthLinkedToAnotherAccount, {
              provider,
            }),
      );
    }
    return this.store(credential);
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
    return Promise.resolve(this.inCreationOrder(matches));
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
    return this.store(membership);
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

  list(query: PageQuery) {
    const matches = [...this.snapshots.values()]
      .filter((snapshot) => query.after === null || snapshot.id > query.after)
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, query.limit);
    return Promise.resolve(matches.map((snapshot) => this.restore(snapshot)));
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
    return this.store(session);
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

  listByAccountId(accountId: string) {
    const matches = [...this.snapshots.values()].filter(
      (snapshot) => snapshot.accountId === accountId,
    );
    return Promise.resolve(this.inCreationOrder(matches));
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
    return this.store(passwordReset);
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
    return Promise.resolve(this.inCreationOrder(matches));
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
    return this.store(emailVerification);
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
    return Promise.resolve(this.inCreationOrder(matches));
  }
}

export class InMemoryInvitationRepository
  extends InMemoryRepository<{
    entity: Invitation;
    snapshot: InvitationSnapshot;
  }>
  implements InvitationRepository
{
  protected toSnapshot(invitation: Invitation) {
    return invitation.toSnapshot();
  }

  protected restore(snapshot: InvitationSnapshot) {
    return Invitation.restore(snapshot);
  }

  save(invitation: Invitation) {
    return this.store(invitation);
  }

  findById(id: string) {
    const found = this.snapshots.get(id);
    return Promise.resolve(found ? this.restore(found) : null);
  }

  findByTokenHash(tokenHash: string) {
    const found = [...this.snapshots.values()].find(
      (snapshot) => snapshot.tokenHash === tokenHash,
    );
    return Promise.resolve(found ? this.restore(found) : null);
  }

  listByEmail(email: string) {
    const matches = [...this.snapshots.values()].filter(
      (snapshot) => snapshot.email === email,
    );
    return Promise.resolve(this.inCreationOrder(matches));
  }

  list() {
    return Promise.resolve(this.inCreationOrder([...this.snapshots.values()]));
  }
}

export class InMemoryEmailChangeRepository
  extends InMemoryRepository<{
    entity: EmailChange;
    snapshot: EmailChangeSnapshot;
  }>
  implements EmailChangeRepository
{
  protected toSnapshot(emailChange: EmailChange) {
    return emailChange.toSnapshot();
  }

  protected restore(snapshot: EmailChangeSnapshot) {
    return EmailChange.restore(snapshot);
  }

  save(emailChange: EmailChange) {
    return this.store(emailChange);
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
    return Promise.resolve(this.inCreationOrder(matches));
  }
}
