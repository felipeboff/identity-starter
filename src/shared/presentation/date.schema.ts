import Type from "typebox";
import { IsDateTime } from "typebox/format";

export const dateSchema = Type.Codec(
  Type.Refine(Type.Unsafe<Date | string>({}), (value) =>
    value instanceof Date
      ? !Number.isNaN(value.getTime())
      : typeof value === "string" &&
        IsDateTime(value) &&
        !Number.isNaN(Date.parse(value)),
  ),
)
  .Decode((value) => new Date(value))
  .Encode((value) => value.toISOString());
