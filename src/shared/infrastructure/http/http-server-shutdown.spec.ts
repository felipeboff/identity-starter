import { once } from "node:events";
import { type Server, createServer, get } from "node:http";
import type { AddressInfo } from "node:net";

import { faker } from "@faker-js/faker";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpServerShutdown } from "./http-server-shutdown";

const listen = async (delayMs?: number) => {
  const server = createServer((_req, res) => {
    if (delayMs !== undefined) setTimeout(() => res.end("done"), delayMs);
  });
  server.listen(0);
  await once(server, "listening");
  return server;
};

const requestInFlight = async (server: Server) => {
  const { port } = server.address() as AddressInfo;
  const received = once(server, "request");
  const response = new Promise<{ status?: number; error?: Error }>(
    (resolve) => {
      get(`http://127.0.0.1:${port}/${faker.lorem.slug()}`, (res) => {
        res.resume();
        res.on("end", () => resolve({ status: res.statusCode }));
      }).on("error", (error) => resolve({ error }));
    },
  );
  await received;
  return response;
};

describe("HttpServerShutdown", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("lets an in-flight request finish before the server closes", async () => {
    const server = await listen(faker.number.int({ min: 50, max: 150 }));
    const shutdown = new HttpServerShutdown(server, 3_000);
    const response = requestInFlight(server);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const startedAt = Date.now();

    const outcome = await shutdown.run();

    expect(outcome).toBe("drained");
    expect(await response).toStrictEqual({ status: 200 });
    expect(server.listening).toBe(false);
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });

  it("closes at once when the only connection is already idle", async () => {
    const server = await listen(0);
    const shutdown = new HttpServerShutdown(server, 3_000);
    await requestInFlight(server);
    const startedAt = Date.now();

    const outcome = await shutdown.run();

    expect(outcome).toBe("drained");
    expect(Date.now() - startedAt).toBeLessThan(1_000);
  });

  it("cuts a request that outlives the timeout", async () => {
    const server = await listen();
    const shutdown = new HttpServerShutdown(server, 100);
    const response = requestInFlight(server);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const outcome = await shutdown.run();

    expect(outcome).toBe("forced");
    expect(await response).toMatchObject({
      error: expect.any(Error) as unknown,
    });
    expect(server.listening).toBe(false);
  });

  it("waits 8 seconds by default", async () => {
    const server = await listen();
    const shutdown = new HttpServerShutdown(server);
    const response = requestInFlight(server);
    await new Promise((resolve) => setTimeout(resolve, 10));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let outcome: string | undefined;

    const running = shutdown.run().then((result) => (outcome = result));
    await vi.advanceTimersByTimeAsync(7_999);
    const before = outcome;
    await vi.advanceTimersByTimeAsync(1);
    await running;

    expect(before).toBeUndefined();
    expect(outcome).toBe("forced");
    await response;
  });
});
