import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import type { Logger } from "@shared/application/ports/logger";
import { AppError } from "@shared/domain/errors/app-error";
import { SharedError } from "@shared/domain/errors/shared.error";
import mongoose, { type Connection } from "mongoose";

export type MongoDatabaseOptions = Readonly<{
  url: string;
  logger: Logger;
  autoIndex?: boolean;
  serverSelectionTimeoutMS?: number;
  heartbeatFrequencyMS?: number;
  pingTimeoutMS?: number;
}>;

export class MongoDatabase {
  readonly connection: Connection = mongoose.createConnection();
  private closing = false;

  constructor(private readonly options: MongoDatabaseOptions) {}

  async connect(): Promise<void> {
    const { url, logger, autoIndex, heartbeatFrequencyMS } = this.options;
    const host = this.hostOf(url);
    try {
      await this.connection.openUri(url, {
        appName: "identity-starter",
        serverSelectionTimeoutMS:
          this.options.serverSelectionTimeoutMS ?? 10_000,
        ...(heartbeatFrequencyMS === undefined ? {} : { heartbeatFrequencyMS }),
        bufferCommands: false,
        autoIndex: autoIndex ?? true,
      });
    } catch (error) {
      logger.error(SharedLogEvent.DatabaseConnectionFailed, { host, error });
      throw new AppError(SharedError.DatabaseUnavailable);
    }

    if (!(await this.isReplicaSetMember())) {
      logger.error(SharedLogEvent.DatabaseNotReplicaSet, { host });
      await this.close();
      throw new AppError(SharedError.DatabaseNotReplicaSet, { host });
    }

    this.connection.on("disconnected", () => {
      if (!this.closing) logger.warn(SharedLogEvent.DatabaseDisconnected);
    });
    this.connection.on("reconnected", () => {
      logger.info(SharedLogEvent.DatabaseReconnected);
    });
    logger.info(SharedLogEvent.DatabaseConnected, {
      host,
      database: this.connection.name,
    });
  }

  async isReady(): Promise<boolean> {
    const db = this.connection.db;
    if (
      this.connection.readyState !== mongoose.ConnectionStates.connected ||
      db === undefined
    )
      return false;

    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(reject, this.options.pingTimeoutMS ?? 1_000);
    });
    try {
      await Promise.race([db.admin().ping(), timedOut]);
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  private async isReplicaSetMember(): Promise<boolean> {
    const hello = await this.connection.db?.admin().command({ hello: 1 });
    return typeof hello?.setName === "string";
  }

  async close(): Promise<void> {
    this.closing = true;
    await this.connection.close();
  }

  private hostOf(url: string): string {
    return url
      .replace(/^[a-z+]+:\/\//i, "")
      .replace(/^[^@/]*@/, "")
      .split(/[/?]/)[0];
  }
}
