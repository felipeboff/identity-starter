import { AppError, ErrorDefinition } from "@shared/domain/errors/app-error";
import { expect } from "vitest";

/** Asserts the promise rejects with an `AppError` of the given definition. */
export const expectAppError = async <Data>(
  promise: Promise<unknown>,
  definition: ErrorDefinition<Data>,
  data?: Data,
): Promise<void> => {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  await expect(promise).rejects.toMatchObject(
    data === undefined
      ? { code: definition.code }
      : { code: definition.code, data },
  );
};
