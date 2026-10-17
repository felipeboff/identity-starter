import { AppError } from "../../../../shared/domain/errors/app-error";
import { IdentityError } from "../errors/identity.error";

export class PasswordHash {
  private constructor(private state: string) {
    this.validate(state);
  }

  public static create(input: string): PasswordHash {
    return new PasswordHash(input);
  }

  public get value(): string {
    return this.state;
  }

  public update(input: string): void {
    this.state = this.validate(input);
  }

  private validate(input: string): string {
    const normalizedInput = input?.toString()?.trim() ?? "";

    if (normalizedInput.length === 0) {
      throw new AppError(IdentityError.PasswordHashRequired, {
        passwordHash: normalizedInput,
      });
    }

    if (!normalizedInput.startsWith("$")) {
      throw new AppError(IdentityError.PasswordHashInvalid, {
        passwordHash: normalizedInput,
      });
    }

    return normalizedInput;
  }
}
