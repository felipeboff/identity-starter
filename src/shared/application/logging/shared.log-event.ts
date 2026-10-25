import { defineLogEvent } from "./log-event";

export const SharedLogEvent = {
  UnexpectedError: defineLogEvent<{ error: unknown }>(
    "shared.unexpected_error",
  ),
  ServerStarted: defineLogEvent<{ port: number }>("shared.server_started"),
  ServerStopped: defineLogEvent("shared.server_stopped"),
  DatabaseConnected: defineLogEvent<{ host: string; database: string }>(
    "shared.database_connected",
  ),
  DatabaseConnectionFailed: defineLogEvent<{ host: string; error: unknown }>(
    "shared.database_connection_failed",
  ),
  DatabaseNotReplicaSet: defineLogEvent<{ host: string }>(
    "shared.database_not_replica_set",
  ),
  DatabaseDisconnected: defineLogEvent("shared.database_disconnected"),
  DatabaseReconnected: defineLogEvent("shared.database_reconnected"),
  RequestCompleted: defineLogEvent<{ status: number; durationMs: number }>(
    "shared.request_completed",
  ),
};
