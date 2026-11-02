import { faker } from "@faker-js/faker";
import { IdGenerator } from "@shared/application/ports/id-generator";

import { AccessToken, AccessTokenClaims } from "../ports/access-token";
import {
  EmailChangedNotice,
  IdentityMailer,
  InvitationEmail,
  TokenEmail,
} from "../ports/identity-mailer";
import {
  OAuthCodeExchange,
  OAuthGateway,
  OAuthProfile,
} from "../ports/oauth-gateway";
import { PasswordHasher } from "../ports/password-hasher";
import { TokenIssuer } from "../ports/token-issuer";

import { OAuthProviderName } from "@/identity/domain/value-objects/oauth-provider.value-object";

export class FakeIdGenerator implements IdGenerator {
  next(): string {
    return faker.database.mongodbObjectId();
  }
}

/** Hashes are readable (`$fake$<password>`) so tests can assert on them. */
export class FakePasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return Promise.resolve(`$fake$${password}`);
  }

  verify(password: string, hash: string | null): Promise<boolean> {
    return Promise.resolve(hash === `$fake$${password}`);
  }
}

export class FakeTokenIssuer implements TokenIssuer {
  issue(): { token: string; tokenHash: string } {
    const token = faker.string.alphanumeric(32);
    return { token, tokenHash: this.hash(token) };
  }

  hash(token: string): string {
    return `hash:${token}`;
  }
}

export class FakeAccessToken implements AccessToken {
  issue(claims: AccessTokenClaims): Promise<string> {
    return Promise.resolve(`access:${claims.accountId}:${claims.sessionId}`);
  }

  verify(token: string): Promise<AccessTokenClaims | null> {
    const [prefix, accountId, sessionId] = token.split(":");
    if (prefix !== "access" || !accountId || !sessionId) {
      return Promise.resolve(null);
    }
    return Promise.resolve({ accountId, sessionId });
  }
}

export class FakeIdentityMailer implements IdentityMailer {
  readonly passwordResets: TokenEmail[] = [];
  readonly emailVerifications: TokenEmail[] = [];
  readonly invitations: InvitationEmail[] = [];
  readonly emailChanges: TokenEmail[] = [];
  readonly emailChangedNotices: EmailChangedNotice[] = [];

  sendPasswordReset(email: TokenEmail): Promise<void> {
    this.passwordResets.push(email);
    return Promise.resolve();
  }

  sendEmailVerification(email: TokenEmail): Promise<void> {
    this.emailVerifications.push(email);
    return Promise.resolve();
  }

  sendInvitation(email: InvitationEmail): Promise<void> {
    this.invitations.push(email);
    return Promise.resolve();
  }

  sendEmailChange(email: TokenEmail): Promise<void> {
    this.emailChanges.push(email);
    return Promise.resolve();
  }

  sendEmailChanged(notice: EmailChangedNotice): Promise<void> {
    this.emailChangedNotices.push(notice);
    return Promise.resolve();
  }
}

/** Resolves codes registered with `register`; unknown codes reject. */
export class FakeOAuthGateway implements OAuthGateway {
  readonly exchanges: OAuthCodeExchange[] = [];
  private readonly profiles = new Map<string, OAuthProfile>();

  register(provider: OAuthProviderName, code: string, profile: OAuthProfile) {
    this.profiles.set(`${provider}:${code}`, profile);
  }

  exchangeCode(exchange: OAuthCodeExchange): Promise<OAuthProfile> {
    this.exchanges.push(exchange);
    const id = `${exchange.provider}:${exchange.code}`;
    const profile = this.profiles.get(id);
    return profile
      ? Promise.resolve(profile)
      : Promise.reject(new Error(`Unknown OAuth code: ${id}`));
  }
}
