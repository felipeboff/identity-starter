import { once } from "node:events";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";

export type SentryEvent = Readonly<{
  environment?: string;
  tags?: Readonly<Record<string, string>>;
  exception?: Readonly<{
    values: readonly Readonly<{
      type: string;
      value: string;
      stacktrace?: Readonly<{ frames: readonly unknown[] }>;
    }>[];
  }>;
}>;

export type FakeSentryIngestOptions = Readonly<{ answers: boolean }>;

type EnvelopeItem = Readonly<{ type: string; payload: unknown }>;

export class FakeSentryIngest {
  private readonly envelopes: string[] = [];

  private constructor(private readonly server: Server) {}

  static async start(
    options: FakeSentryIngestOptions = { answers: true },
  ): Promise<FakeSentryIngest> {
    const server = createServer();
    const ingest = new FakeSentryIngest(server);
    server.on("request", (req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        ingest.envelopes.push(Buffer.concat(chunks).toString());
        if (options.answers) res.end("{}");
      });
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    return ingest;
  }

  get dsn(): string {
    const { port } = this.server.address() as AddressInfo;
    return `http://public@127.0.0.1:${port}/1`;
  }

  raw(): string {
    return this.envelopes.join("\n");
  }

  events(): SentryEvent[] {
    return this.envelopes
      .flatMap((envelope) => this.itemsOf(envelope))
      .filter((item) => item.type === "event")
      .map((item) => item.payload as SentryEvent);
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    this.server.close();
    await once(this.server, "close");
  }

  private itemsOf(envelope: string): EnvelopeItem[] {
    const [, ...lines] = envelope.split("\n").filter((line) => line !== "");
    const items: EnvelopeItem[] = [];
    for (let index = 0; index + 1 < lines.length; index += 2) {
      const header = JSON.parse(lines[index]) as { type: string };
      items.push({
        type: header.type,
        payload: JSON.parse(lines[index + 1]),
      });
    }
    return items;
  }
}
