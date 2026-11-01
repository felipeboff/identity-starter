import { faker } from "@faker-js/faker";
import mongoose, { type Connection } from "mongoose";
import { afterAll, beforeAll, inject } from "vitest";

export const memoryMongoUri = (database: string): string => {
  const uri = new URL(inject("mongoUri"));
  uri.pathname = `/${database}`;
  return uri.href;
};

export const useMemoryMongo = () => {
  let connection: Connection | undefined;

  beforeAll(async () => {
    connection = await mongoose
      .createConnection(inject("mongoUri"), {
        dbName: faker.string.alpha({ length: 12, casing: "lower" }),
      })
      .asPromise();
  });

  afterAll(async () => {
    await connection?.dropDatabase();
    await connection?.close();
  });

  return { connection: () => connection as Connection };
};
