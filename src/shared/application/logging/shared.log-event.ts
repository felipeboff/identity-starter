import { defineLogEvent } from "./log-event";

export const SharedLogEvent = {
  /** Anything thrown that is not an `AppError`; answered as `500 shared.internal`. */
  UnexpectedError: defineLogEvent<{ error: unknown }>(
    "shared.unexpected_error",
  ),
  ServerStarted: defineLogEvent<{ port: number }>("shared.server_started"),
  /** One per HTTP request, after the response is sent; carries the request's log context. */
  RequestCompleted: defineLogEvent<{ status: number; durationMs: number }>(
    "shared.request_completed",
  ),
};
