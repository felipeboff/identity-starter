import { faker } from "@faker-js/faker";
import { AppError, defineError } from "@shared/domain/errors/app-error";
import { describe, expect, it } from "vitest";

import { expectAppError } from "./expect-app-error";

const TicketNotFound = defineError<{ ticketId: string }>(
  `${faker.lorem.word()}.${faker.lorem.word()}`,
  "not_found",
);
const Unauthenticated = defineError(
  `${faker.lorem.word()}.${faker.lorem.word()}`,
  "unauthenticated",
);

const ticketNotFound = (ticketId: string) =>
  Promise.reject(new AppError(TicketNotFound, { ticketId }));

describe("expectAppError", () => {
  it("passes when the code matches and no data is given", async () => {
    await expectAppError(
      Promise.reject(new AppError(Unauthenticated)),
      Unauthenticated,
    );
  });

  it("passes when the code and data match", async () => {
    const ticketId = faker.database.mongodbObjectId();

    await expectAppError(ticketNotFound(ticketId), TicketNotFound, {
      ticketId,
    });
  });

  it("fails when the data differs", async () => {
    const ticketId = faker.database.mongodbObjectId();

    await expect(
      expectAppError(ticketNotFound(ticketId), TicketNotFound, {
        ticketId: faker.database.mongodbObjectId(),
      }),
    ).rejects.toThrow();
  });

  it("fails when the promise resolves", async () => {
    await expect(
      expectAppError(Promise.resolve(), Unauthenticated),
    ).rejects.toThrow();
  });
});
