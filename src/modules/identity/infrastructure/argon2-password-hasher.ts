import { randomUUID } from "node:crypto";

import argon2 from "argon2";

import { PasswordHasher } from "../application/ports/password-hasher";

export class Argon2PasswordHasher implements PasswordHasher {
  private decoyHash: string | undefined;

  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async verify(password: string, hash: string | null): Promise<boolean> {
    if (hash !== null) return argon2.verify(hash, password);

    this.decoyHash ??= await this.hash(randomUUID());
    await argon2.verify(this.decoyHash, password);
    return false;
  }
}
