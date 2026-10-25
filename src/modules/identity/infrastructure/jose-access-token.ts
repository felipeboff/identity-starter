import { Clock } from "@shared/application/ports/clock";
import { SignJWT, jwtVerify } from "jose";

import {
  AccessToken,
  AccessTokenClaims,
} from "../application/ports/access-token";
import { ACCESS_TOKEN_TTL_MS } from "../application/session.policy";

const ALGORITHM = "HS256";

type JoseAccessTokenDeps = {
  secret: string;
  clock: Clock;
};

export class JoseAccessToken implements AccessToken {
  private readonly key: Uint8Array;

  constructor(private readonly deps: JoseAccessTokenDeps) {
    this.key = new TextEncoder().encode(deps.secret);
  }

  issue({ accountId, sessionId }: AccessTokenClaims): Promise<string> {
    const issuedAt = Math.floor(this.deps.clock.now().getTime() / 1000);
    return new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: ALGORITHM, typ: "JWT" })
      .setSubject(accountId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ACCESS_TOKEN_TTL_MS / 1000)
      .sign(this.key);
  }

  async verify(token: string): Promise<AccessTokenClaims | null> {
    const { payload } = await jwtVerify(token, this.key, {
      algorithms: [ALGORITHM],
      currentDate: this.deps.clock.now(),
      requiredClaims: ["sub", "sid", "iat", "exp"],
    }).catch(() => ({ payload: null }));

    if (typeof payload?.sub !== "string" || typeof payload.sid !== "string") {
      return null;
    }
    return { accountId: payload.sub, sessionId: payload.sid };
  }
}
