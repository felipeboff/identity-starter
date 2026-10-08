import { AppError } from "../errors/app-error";
import { SharedError } from "../errors/shared.error";

export class Email {
  private readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private readonly MAX_LENGTH = 254;

  private constructor(private readonly state: string) {
    this.state = this.validate(state);
  }

  public static create(input: string): Email {
    return new Email(input);
  }

  public get value(): string {
    return this.state;
  }

  public equals(other: Email): boolean {
    return this.value === other.value;
  }

  private validate(input: string): string {
    const normalizedInput = input?.trim().toLowerCase() ?? "";

    if (normalizedInput.length === 0) {
      throw new AppError(SharedError.EmailRequired, { email: normalizedInput });
    }

    if (!this.EMAIL_REGEX.test(normalizedInput)) {
      throw new AppError(SharedError.EmailInvalid, { email: normalizedInput });
    }

    if (normalizedInput.length > this.MAX_LENGTH) {
      throw new AppError(SharedError.EmailTooLong, {
        maxLength: this.MAX_LENGTH,
        length: normalizedInput.length,
      });
    }

    return normalizedInput;
  }
}
