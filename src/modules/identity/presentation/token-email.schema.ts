import { dateSchema } from "@shared/presentation/date.schema";
import Type from "typebox";

export const tokenEmailSchema = Type.Object({
  to: Type.String({ format: "email" }),
  name: Type.String(),
  token: Type.String({ minLength: 1 }),
  expiresAt: dateSchema,
});

export type TokenEmailInput = Type.StaticDecode<typeof tokenEmailSchema>;
