import { AppError } from "../errors/app-error";
import { SharedError } from "../errors/shared.error";

export class Id {
  private readonly OBJECT_ID_REGEX = /^[0-9a-f]{24}$/;

  private constructor(private readonly state: string) {
    this.state = this.validate(state);
  }

  public static create(input: string): Id {
    return new Id(input);
  }

  public get value(): string {
    return this.state;
  }

  public equals(other: Id): boolean {
    return this.value === other.value;
  }

  private validate(input: string): string {
    const normalizedInput = input?.trim()?.toLowerCase() ?? "";

    if (normalizedInput.length === 0) {
      throw new AppError(SharedError.IdRequired, { id: normalizedInput });
    }

    if (!this.OBJECT_ID_REGEX.test(normalizedInput)) {
      throw new AppError(SharedError.IdInvalid, { id: normalizedInput });
    }

    return normalizedInput;
  }
}
