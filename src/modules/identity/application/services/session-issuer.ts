import { IdGenerator } from "@shared/application/ports/id-generator";

import { AccessToken } from "../ports/access-token";
import { SessionRepository } from "../ports/session.repository";
import { TokenIssuer } from "../ports/token-issuer";
import { REFRESH_TOKEN_TTL_MS } from "../session.policy";

import { Session } from "@/identity/domain/session.entity";

export type IssueSessionInput = {
  accountId: string;
  credentialId: string;
  membershipId: string;
  userAgent: string;
  ipAddress: string;
};

export type IssuedSession = {
  session: Session;
  accessToken: string;
  refreshToken: string;
};

type SessionIssuerDeps = {
  sessions: SessionRepository;
  accessToken: AccessToken;
  tokens: TokenIssuer;
  ids: IdGenerator;
};

/** Shared by every flow that hands out tokens. */
export class SessionIssuer {
  constructor(private readonly deps: SessionIssuerDeps) {}

  async issue(input: IssueSessionInput, at: Date): Promise<IssuedSession> {
    const { token: refreshToken, tokenHash } = this.deps.tokens.issue();

    const session = Session.register(
      {
        id: this.deps.ids.next(),
        accountId: input.accountId,
        credentialId: input.credentialId,
        membershipId: input.membershipId,
        tokenHash,
        expiresAt: new Date(at.getTime() + REFRESH_TOKEN_TTL_MS),
        userAgent: input.userAgent,
        ipAddress: input.ipAddress,
      },
      at,
    );
    await this.deps.sessions.save(session);

    const accessToken = await this.deps.accessToken.issue({
      accountId: input.accountId,
      sessionId: session.id.value,
    });

    return { session, accessToken, refreshToken };
  }
}
