import { AppError } from "@shared/domain/errors/app-error";

import { IdentityError } from "../errors/identity.error";

export class TokenHash {
  private constructor(private readonly state: string) {
    this.state = this.validate(state);
  }

  public static create(input: string): TokenHash {
    return new TokenHash(input);
  }

  public get value(): string {
    return this.state;
  }

  public equals(other: TokenHash): boolean {
    return this.value === other.value;
  }

  private validate(input: string): string {
    const normalizedInput = input?.toString()?.trim() ?? "";

    if (normalizedInput.length === 0) {
      throw new AppError(IdentityError.TokenHashRequired, {
        tokenHash: normalizedInput,
      });
    }

    return normalizedInput;
  }
}
