import { NodeEnv, env, toIdentitySettings } from "@app/config";
import { isAppError } from "@shared/domain/errors/app-error";
import { AsyncLocalLogContext } from "@shared/infrastructure/logging/async-local-log-context";
import { PinoLogger } from "@shared/infrastructure/logging/pino-logger";
import { MongoDatabase } from "@shared/infrastructure/mongo/mongo-database";
import { MongoOutbox } from "@shared/infrastructure/mongo/mongo-outbox";
import { MongoTransactionRunner } from "@shared/infrastructure/mongo/mongo-transaction-runner";
import { RedisConnection } from "@shared/infrastructure/redis/redis-connection";
import { SystemClock } from "@shared/infrastructure/time/system-clock";

import { createIdentityModule } from "@/identity/identity.module";

// Gives an existing account the admin role and every permission, reading .env:
//   pnpm identity:grant-admin ana@example.com
// Exits with 1 and logs identity.admin_grant_failed when the account is missing or deactivated.
const logContext = new AsyncLocalLogContext();
const logger = PinoLogger.create({
  service: env.APP_NAME,
  environment: env.NODE_ENV,
  level: env.LOG_LEVEL,
  format: env.NODE_ENV === NodeEnv.DEVELOP ? "pretty" : "json",
  destination: process.stdout,
  context: logContext,
});
const database = new MongoDatabase({
  url: env.MONGO_URL,
  appName: env.APP_NAME,
  logger,
});
const cache = new RedisConnection({ url: env.REDIS_URL.href, logger });

await database.connect();
try {
  await cache.connect();
  try {
    const clock = new SystemClock();
    const identity = await createIdentityModule(toIdentitySettings(env), {
      connection: database.connection,
      redis: cache.client,
      logger,
      logContext,
      outbox: new MongoOutbox({ connection: database.connection, clock }),
      transactions: new MongoTransactionRunner(database.connection),
      clock,
    });
    await identity.grantAdmin.execute({ email: process.argv[2] ?? "" });
  } finally {
    await cache.close();
  }
} catch (error) {
  if (!isAppError(error)) throw error;
  process.exitCode = 1;
} finally {
  await database.close();
}
