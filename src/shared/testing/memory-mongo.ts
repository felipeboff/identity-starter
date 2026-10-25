import { faker } from "@faker-js/faker";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { type Connection } from "mongoose";
import { afterAll, beforeAll } from "vitest";

export const useMemoryMongo = () => {
  let replicaSet: MongoMemoryReplSet | undefined;
  let connection: Connection | undefined;

  beforeAll(async () => {
    replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    connection = await mongoose
      .createConnection(replicaSet.getUri(), {
        dbName: faker.string.alpha({ length: 12, casing: "lower" }),
      })
      .asPromise();
  });

  afterAll(async () => {
    await connection?.close();
    await replicaSet?.stop();
  });

  return { connection: () => connection as Connection };
};
