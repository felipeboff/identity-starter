import { faker } from "@faker-js/faker";

export const UUID_OPTIONS = { version: 7 } as const;

export const fakeUuid = (
  options: typeof UUID_OPTIONS = UUID_OPTIONS,
): string => {
  return faker.string.uuid(options);
};
