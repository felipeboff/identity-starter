import { faker } from "@faker-js/faker";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, { type Connection } from "mongoose";
import { afterAll, beforeAll } from "vitest";

export const useMemoryMongo = () => {
  let server: MongoMemoryServer | undefined;
  let connection: Connection | undefined;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    connection = await mongoose
      .createConnection(server.getUri(), {
        dbName: faker.string.alpha({ length: 12, casing: "lower" }),
      })
      .asPromise();
  });

  afterAll(async () => {
    await connection?.close();
    await server?.stop();
  });

  return { connection: () => connection as Connection };
};
