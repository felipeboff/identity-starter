import { createHash, timingSafeEqual } from "node:crypto";

import type { RequestHandler } from "express";

export type BasicAuthCredentials = Readonly<{
  username: string;
  password: string;
}>;

export type BasicAuthDeps = Readonly<{
  realm: string;
  credentials: BasicAuthCredentials;
}>;

const SCHEME = "Basic ";

export class BasicAuth {
  constructor(private readonly deps: BasicAuthDeps) {}

  guard(): RequestHandler {
    return (req, res, next) => {
      if (this.accepts(req.get("authorization"))) {
        next();
        return;
      }
      res
        .status(401)
        .set(
          "www-authenticate",
          `Basic realm="${this.deps.realm}", charset="UTF-8"`,
        )
        .end();
    };
  }

  private accepts(header: string | undefined): boolean {
    if (header?.startsWith(SCHEME) !== true) return false;
    const decoded = Buffer.from(header.slice(SCHEME.length), "base64").toString(
      "utf8",
    );
    const separator = decoded.indexOf(":");
    if (separator === -1) return false;

    const username = this.matches(
      decoded.slice(0, separator),
      this.deps.credentials.username,
    );
    const password = this.matches(
      decoded.slice(separator + 1),
      this.deps.credentials.password,
    );
    return username && password;
  }

  private matches(given: string, expected: string): boolean {
    return timingSafeEqual(this.digestOf(given), this.digestOf(expected));
  }

  private digestOf(value: string): Buffer {
    return createHash("sha256").update(value).digest();
  }
}
