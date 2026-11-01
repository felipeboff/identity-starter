import Type from "typebox";

import {
  PAGE_DEFAULT_LIMIT,
  PAGE_MAX_LIMIT,
} from "../application/pagination.policy";
import { OBJECT_ID_PATTERN } from "../domain/value-objects/id.value-object";

export const pageRequestFields = {
  cursor: Type.Optional(Type.String({ pattern: OBJECT_ID_PATTERN })),
  limit: Type.Integer({
    minimum: 1,
    maximum: PAGE_MAX_LIMIT,
    default: PAGE_DEFAULT_LIMIT,
  }),
};
