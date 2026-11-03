import {
  PERMISSION_MAX_LENGTH,
  PERMISSION_PATTERN,
} from "@shared/domain/value-objects/permission-catalog.value-object";
import Type from "typebox";

export const permissionsSchema = Type.Array(
  Type.String({
    pattern: PERMISSION_PATTERN,
    maxLength: PERMISSION_MAX_LENGTH,
  }),
);
