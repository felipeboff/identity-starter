import { env } from "@app/config";
import { handleShutdownSignals } from "@app/shutdown";
import { start } from "@app/start";

handleShutdownSignals(
  await start({ env, logDestination: process.stdout }),
  process,
);
