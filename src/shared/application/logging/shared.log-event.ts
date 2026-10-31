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
  CacheConnected: defineLogEvent<{ host: string }>("shared.cache_connected"),
  CacheConnectionFailed: defineLogEvent<{ host: string; error: unknown }>(
    "shared.cache_connection_failed",
  ),
  RateLimiterUnavailable: defineLogEvent<{ rule: string; error: unknown }>(
    "shared.rate_limiter_unavailable",
  ),
  CacheCallFailed: defineLogEvent<{
    operation: "get" | "set" | "delete";
    key: string;
    error: unknown;
  }>("shared.cache_call_failed"),
  ExternalCallRetried: defineLogEvent<{
    method: string;
    url: string;
    attempt: number;
    failure: "network" | "status";
    status?: number;
  }>("shared.external_call_retried"),
  RequestCompleted: defineLogEvent<{ status: number; durationMs: number }>(
    "shared.request_completed",
  ),
};
