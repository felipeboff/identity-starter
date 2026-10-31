import Type from "typebox";

export const codeVerifierSchema = Type.Optional(
  Type.String({ minLength: 43, maxLength: 128 }),
);
