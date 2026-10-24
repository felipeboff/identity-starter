import type { Server } from "node:http";

export type ShutdownOutcome = "drained" | "forced";

export class HttpServerShutdown {
  private closing = false;

  constructor(
    private readonly server: Server,
    private readonly timeoutMs = 8_000,
  ) {
    // `close()` only closes the connections idle at that moment; one that goes idle later stays open.
    server.on("request", (_req, res) => {
      res.once("finish", () => {
        if (this.closing) setImmediate(() => server.closeIdleConnections());
      });
    });
  }

  async run(): Promise<ShutdownOutcome> {
    this.closing = true;
    const closed = new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<ShutdownOutcome>((resolve) => {
      timer = setTimeout(() => resolve("forced"), this.timeoutMs);
    });

    const outcome = await Promise.race([
      closed.then((): ShutdownOutcome => "drained"),
      timedOut,
    ]);
    clearTimeout(timer);
    if (outcome === "forced") {
      this.server.closeAllConnections();
      await closed;
    }
    return outcome;
  }
}
