import { OBJECT_ID_PATTERN } from "@shared/domain/value-objects/id.value-object";
import { dateTimeSchema } from "@shared/presentation/date.schema";
import Type from "typebox";

import { permissionsSchema } from "./permissions.schema";

import { AuthProvider } from "@/identity/domain/credential.entity";
import { MembershipRole } from "@/identity/domain/membership.entity";

const idSchema = Type.String({ pattern: OBJECT_ID_PATTERN });

const nullableDateTimeSchema = Type.Union([dateTimeSchema, Type.Null()]);

const roleSchema = Type.Enum(Object.values(MembershipRole));

export const accountOutputSchema = Type.Object({
  id: idSchema,
  name: Type.String(),
  email: Type.String({ format: "email" }),
  emailVerifiedAt: nullableDateTimeSchema,
  lastSeenAt: nullableDateTimeSchema,
  createdAt: dateTimeSchema,
  deactivatedAt: nullableDateTimeSchema,
});

export const membershipOutputSchema = Type.Object({
  id: idSchema,
  accountId: idSchema,
  role: roleSchema,
  permissions: permissionsSchema,
  updatedAt: dateTimeSchema,
});

export const credentialOutputSchema = Type.Object({
  id: idSchema,
  provider: Type.Enum(Object.values(AuthProvider)),
  providerEmail: Type.Union([Type.String({ format: "email" }), Type.Null()]),
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
});

export const invitationOutputSchema = Type.Object({
  id: idSchema,
  email: Type.String({ format: "email" }),
  role: roleSchema,
  permissions: permissionsSchema,
  createdAt: dateTimeSchema,
  expiresAt: dateTimeSchema,
});

export const listedSessionOutputSchema = Type.Object({
  id: idSchema,
  userAgent: Type.String(),
  ipAddress: Type.String(),
  createdAt: dateTimeSchema,
  expiresAt: dateTimeSchema,
  current: Type.Boolean(),
});

export const signedInOutputFields = {
  account: accountOutputSchema,
  accessToken: Type.String(),
  refreshToken: Type.String(),
};
