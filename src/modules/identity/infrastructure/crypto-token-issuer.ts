import { createHash, randomBytes } from "node:crypto";

import { TokenIssuer } from "../application/ports/token-issuer";

export class CryptoTokenIssuer implements TokenIssuer {
  issue() {
    const token = randomBytes(32).toString("base64url");
    return { token, tokenHash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
