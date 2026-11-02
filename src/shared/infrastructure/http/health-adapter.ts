import type { RequestHandler } from "express";

export type Readiness = Readonly<{ isReady(): Promise<boolean> }>;

export type HealthAdapterDeps = Readonly<{
  readiness: Readiness;
}>;

export class HealthAdapter {
  constructor(private readonly deps: HealthAdapterDeps) {}

  handler(): RequestHandler {
    return async (_req, res) => {
      const ready = await this.deps.readiness.isReady();
      res
        .status(ready ? 200 : 503)
        .json({ status: ready ? "ok" : "unavailable" });
    };
  }
}
