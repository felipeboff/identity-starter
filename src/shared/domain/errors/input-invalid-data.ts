export type InputViolation = Readonly<{
  field: string;
  reason: string;
}>;

/** Payload of `shared.input_invalid`: which fields a schema refused and why. */
export type InputInvalidData = Readonly<{
  violations: readonly InputViolation[];
}>;
