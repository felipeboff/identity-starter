import { defineLogEvent } from "./log-event";

export const SharedLogEvent = {
  /** Anything thrown that is not an `AppError`; answered as `500 shared.internal`. */
  UnexpectedError: defineLogEvent<{ error: unknown }>(
    "shared.unexpected_error",
  ),
  ServerStarted: defineLogEvent<{ port: number }>("shared.server_started"),
};
