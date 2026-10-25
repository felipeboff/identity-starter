import argon2 from "argon2";

import { PasswordHasher } from "../application/ports/password-hasher";

export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  verify(password: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}
