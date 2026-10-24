import { env } from "@app/config";
import { start } from "@app/start";

await start({ env, logDestination: process.stdout });
