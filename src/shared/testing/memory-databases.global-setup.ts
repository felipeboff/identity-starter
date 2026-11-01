import { MongoMemoryReplSet } from "mongodb-memory-server";
import { RedisMemoryServer } from "redis-memory-server";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
    redisUrl: string;
    redisDatabases: number;
  }
}

const REDIS_DATABASES = 64;

export default async function setup(project: TestProject) {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const redis = await RedisMemoryServer.create({
    instance: { args: ["--databases", String(REDIS_DATABASES)] },
  });
  project.provide("mongoUri", mongo.getUri());
  project.provide(
    "redisUrl",
    `redis://${await redis.getHost()}:${await redis.getPort()}`,
  );
  project.provide("redisDatabases", REDIS_DATABASES);

  return async () => {
    await redis.stop();
    await mongo.stop();
  };
}
