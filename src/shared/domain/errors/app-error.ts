export type ErrorKind =
  | "invalid_input"
  | "not_found"
  | "conflict"
  | "forbidden"
  | "unauthenticated"
  | "precondition_failed";

export type ErrorDefinition<Data = never> = {
  code: string;
  kind: ErrorKind;
  readonly $data?: Data;
};

export function defineError<Data = never>(
  code: string,
  kind: ErrorKind,
): ErrorDefinition<Data> {
  return { code, kind };
}

export class AppError<Data = never> extends Error {
  readonly code: string;
  readonly kind: ErrorKind;
  readonly data: Data | undefined;

  constructor(definition: ErrorDefinition<never>);
  constructor(definition: ErrorDefinition<Data>, data: Data);

  constructor(definition: ErrorDefinition<Data>, data?: Data) {
    super(definition.code);

    this.name = "AppError";
    this.code = definition.code;
    this.kind = definition.kind;
    this.data = data;
  }
}

export function isAppError(error: unknown): error is AppError<unknown> {
  return error instanceof AppError;
}
