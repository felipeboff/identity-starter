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
    operation: "get" | "set" | "setIfNewer" | "delete";
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
  OutboxEffectFailed: defineLogEvent<{
    id: string;
    type: string;
    attempts: number;
    error: unknown;
  }>("shared.outbox_effect_failed"),
  OutboxEffectAbandoned: defineLogEvent<{
    id: string;
    type: string;
    attempts: number;
  }>("shared.outbox_effect_abandoned"),
  OutboxRelayFailed: defineLogEvent<{ error: unknown }>(
    "shared.outbox_relay_failed",
  ),
  BrokerConnected: defineLogEvent<{ host: string }>("shared.broker_connected"),
  BrokerConnectionFailed: defineLogEvent<{ host: string; error: unknown }>(
    "shared.broker_connection_failed",
  ),
  BrokerDisconnected: defineLogEvent<{ host: string; error: unknown }>(
    "shared.broker_disconnected",
  ),
  BrokerChannelFailed: defineLogEvent<{ channel: string; error: unknown }>(
    "shared.broker_channel_failed",
  ),
  MessageRefused: defineLogEvent<{
    event: string;
    consumer: string;
    id: string;
    code: string;
  }>("shared.message_refused"),
  MessageFailed: defineLogEvent<{
    event: string;
    consumer: string;
    id: string;
    attempts: number;
    error: unknown;
  }>("shared.message_failed"),
  MessageDeadLettered: defineLogEvent<{
    event: string;
    consumer: string;
    id: string;
    attempts: number;
    error: unknown;
  }>("shared.message_dead_lettered"),
  MessageUnsettled: defineLogEvent<{
    event: string;
    consumer: string;
    id: string;
    error: unknown;
  }>("shared.message_unsettled"),
  ScheduledJobFailed: defineLogEvent<{
    name: string;
    attempts: number;
    error: unknown;
  }>("shared.scheduled_job_failed"),
};
