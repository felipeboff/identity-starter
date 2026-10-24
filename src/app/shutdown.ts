import type { RunningApp } from "./start";

export type ShutdownProcess = Readonly<{
  on(signal: "SIGTERM" | "SIGINT", listener: () => void): unknown;
  exit(code: number): void;
}>;

export const handleShutdownSignals = (
  app: Pick<RunningApp, "stop">,
  process: ShutdownProcess,
): void => {
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    app.stop().then(
      (code) => process.exit(code),
      () => process.exit(1),
    );
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
};
