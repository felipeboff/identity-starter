import { faker } from "@faker-js/faker";
import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import { LogLevel } from "@shared/application/ports/logger";
import { FakeLogger } from "@shared/testing/fake-logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FetchHttpClient } from "./fetch-http-client";

type FetchMock = ReturnType<typeof vi.fn<typeof globalThis.fetch>>;

type Reply = Response | Error;

const answer = (status: number, body = "", headers?: HeadersInit) =>
  new Response(body, { status, headers });

const respondWith = (body: string, status = 200) =>
  vi.fn<typeof globalThis.fetch>(() => Promise.resolve(answer(status, body)));

const replyInOrder = (...replies: readonly Reply[]) => {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const reply of replies) {
    fetch.mockImplementationOnce(() =>
      reply instanceof Response
        ? Promise.resolve(reply)
        : Promise.reject(reply),
    );
  }
  return fetch;
};

const failWith = (error: Error) =>
  vi.fn<typeof globalThis.fetch>(() => Promise.reject(error));

const undiciNetworkError = () => new TypeError("fetch failed");

const hangs = () =>
  vi.fn<typeof globalThis.fetch>(
    (input) =>
      new Promise((_resolve, reject) => {
        const { signal } = input as Request;
        signal.addEventListener("abort", () => reject(signal.reason as Error));
      }),
  );

const recordBodies = () => {
  const bodies: string[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
    bodies.push(await (input as Request).text());
    return answer(200);
  });
  return { fetch, bodies };
};

const requestAt = (fetch: FetchMock, index = 0) =>
  fetch.mock.calls[index]?.[0] as Request;

const buildTimeout = () => faker.number.int({ min: 1_000, max: 10_000 });

const buildJson = () => ({
  id: faker.number.int(),
  email: faker.internet.email(),
});

const create = (fetch: FetchMock, timeoutMs = buildTimeout()) => {
  const logger = new FakeLogger();
  const client = new FetchHttpClient({ timeoutMs, logger, fetch });
  return { client, logger };
};

const get = (client: FetchHttpClient, url = faker.internet.url()) =>
  client.send({ method: "GET", url });

describe("FetchHttpClient", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("request and response", () => {
    it("sends the method, URL and headers, without a body when there is none", async () => {
      const fetch = respondWith("");
      const { client } = create(fetch);
      const url = faker.internet.url();
      const authorization = `Bearer ${faker.string.alphanumeric(32)}`;

      await client.send({ method: "GET", url, headers: { authorization } });

      const request = requestAt(fetch);
      expect(request.method).toBe("GET");
      expect(request.url).toBe(new URL(url).href);
      expect(request.headers.get("authorization")).toBe(authorization);
      expect(request.body).toBeNull();
    });

    it("encodes a JSON body", async () => {
      const { fetch, bodies } = recordBodies();
      const { client } = create(fetch);
      const json = {
        name: faker.person.fullName(),
        tags: [faker.lorem.word()],
      };

      await client.send({
        method: "POST",
        url: faker.internet.url(),
        body: { json },
      });

      const request = requestAt(fetch);
      expect(request.method).toBe("POST");
      expect(request.headers.get("content-type")).toBe("application/json");
      expect(bodies).toStrictEqual([JSON.stringify(json)]);
    });

    it("encodes a form body", async () => {
      const { fetch, bodies } = recordBodies();
      const { client } = create(fetch);
      const form = {
        code: faker.string.alphanumeric(20),
        name: faker.person.fullName(),
      };

      await client.send({
        method: "POST",
        url: faker.internet.url(),
        body: { form },
      });

      const request = requestAt(fetch);
      expect(request.headers.get("content-type")).toBe(
        "application/x-www-form-urlencoded",
      );
      expect(bodies).toStrictEqual([new URLSearchParams(form).toString()]);
    });

    it("lets the caller's headers win over the content type", async () => {
      const fetch = respondWith("");
      const { client } = create(fetch);
      const contentType = `application/${faker.lorem.word()}+json`;

      await client.send({
        method: "POST",
        url: faker.internet.url(),
        headers: { "content-type": contentType },
        body: { json: {} },
      });

      expect(requestAt(fetch).headers.get("content-type")).toBe(contentType);
    });

    it("returns the status and the JSON body", async () => {
      const body = buildJson();
      const status = faker.helpers.arrayElement([200, 201, 400, 401]);
      const { client } = create(respondWith(JSON.stringify(body), status));

      const result = await get(client);

      expect(result).toStrictEqual({ ok: true, status, body });
    });

    it("returns a null body when the response is empty", async () => {
      const { client } = create(respondWith("", 202));

      const result = await get(client);

      expect(result).toStrictEqual({ ok: true, status: 202, body: null });
    });

    it("returns the raw text when the body is not JSON", async () => {
      const text = `<p>${faker.lorem.sentence()}</p>`;
      const { client } = create(respondWith(text, 403));

      const result = await get(client);

      expect(result).toStrictEqual({ ok: true, status: 403, body: text });
    });

    it("uses the global fetch when none is given", async () => {
      const fetch = respondWith("");
      vi.stubGlobal("fetch", fetch);
      const client = new FetchHttpClient({
        timeoutMs: buildTimeout(),
        logger: new FakeLogger(),
      });
      const url = faker.internet.url();

      await client.send({ method: "GET", url });

      expect(requestAt(fetch).url).toBe(new URL(url).href);
    });
  });

  describe("retries", () => {
    beforeEach(() => {
      vi.spyOn(Math, "random").mockReturnValue(0);
    });

    it("retries a GET after a network error and returns the next answer", async () => {
      const body = buildJson();
      const fetch = replyInOrder(
        undiciNetworkError(),
        answer(200, JSON.stringify(body)),
      );
      const { client } = create(fetch);

      const result = await get(client);

      expect(result).toStrictEqual({ ok: true, status: 200, body });
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it.each([408, 500, 502, 503, 504])(
      "retries a GET answering %i up to twice",
      async (status) => {
        const body = buildJson();
        const fetch = replyInOrder(
          answer(status),
          answer(status),
          answer(200, JSON.stringify(body)),
        );
        const { client } = create(fetch);

        const result = await get(client);

        expect(result).toStrictEqual({ ok: true, status: 200, body });
        expect(fetch).toHaveBeenCalledTimes(3);
      },
    );

    it("returns a network failure after the second retry", async () => {
      const fetch = failWith(undiciNetworkError());
      const { client } = create(fetch);

      const result = await get(client);

      expect(result).toStrictEqual({ ok: false, failure: "network" });
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("returns the last retryable answer after the second retry", async () => {
      const json = { "content-type": "application/json" };
      const last = buildJson();
      const fetch = replyInOrder(
        answer(503, JSON.stringify(buildJson()), json),
        answer(503, JSON.stringify(buildJson()), json),
        answer(503, JSON.stringify(last), json),
      );
      const { client } = create(fetch);

      const result = await get(client);

      expect(result).toStrictEqual({ ok: true, status: 503, body: last });
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it.each([
      {
        failure: "a network error",
        fetch: () => failWith(undiciNetworkError()),
        result: { ok: false, failure: "network" },
      },
      {
        failure: "503",
        fetch: () => respondWith("", 503),
        result: { ok: true, status: 503, body: null },
      },
    ])(
      "sends a POST once even when it fails with $failure",
      async ({ fetch: buildFetch, result: expected }) => {
        const fetch = buildFetch();
        const { client } = create(fetch);

        const result = await client.send({
          method: "POST",
          url: faker.internet.url(),
          body: { form: { code: faker.string.alphanumeric(20) } },
        });

        expect(result).toStrictEqual(expected);
        expect(fetch).toHaveBeenCalledTimes(1);
      },
    );

    it.each([400, 401, 404, 429])(
      "does not retry a GET answering %i",
      async (status) => {
        const fetch = respondWith("", status);
        const { client } = create(fetch);

        const result = await get(client);

        expect(result).toStrictEqual({ ok: true, status, body: null });
        expect(fetch).toHaveBeenCalledTimes(1);
      },
    );

    it("reports a network failure without retrying when fetch rejects for any other reason", async () => {
      const fetch = failWith(new TypeError(faker.lorem.sentence()));
      const { client } = create(fetch);

      const result = await get(client);

      expect(result).toStrictEqual({ ok: false, failure: "network" });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("logs each retry after a network error", async () => {
      const endpoint = new URL(`/${faker.lorem.word()}`, faker.internet.url())
        .href;
      const query = `${faker.lorem.word()}=${faker.string.alphanumeric(16)}`;
      const fetch = replyInOrder(
        undiciNetworkError(),
        undiciNetworkError(),
        answer(200),
      );
      const { client, logger } = create(fetch);

      await get(client, `${endpoint}?${query}`);

      const retried = (attempt: number) => ({
        level: LogLevel.WARN,
        event: SharedLogEvent.ExternalCallRetried.name,
        fields: { method: "GET", url: endpoint, attempt, failure: "network" },
      });
      expect(logger.entries).toStrictEqual([retried(1), retried(2)]);
    });

    it("logs a retry after a retryable status with the status", async () => {
      const url = faker.internet.url();
      const { client, logger } = create(replyInOrder(answer(502), answer(200)));

      await get(client, url);

      expect(logger.entries).toStrictEqual([
        {
          level: LogLevel.WARN,
          event: SharedLogEvent.ExternalCallRetried.name,
          fields: {
            method: "GET",
            url: new URL(url).href,
            attempt: 1,
            failure: "status",
            status: 502,
          },
        },
      ]);
    });
  });

  describe("backoff", () => {
    const expectAttemptsAt = async (
      fetch: FetchMock,
      retriesAt: readonly number[],
    ) => {
      let elapsed = 0;
      for (const [index, at] of retriesAt.entries()) {
        await vi.advanceTimersByTimeAsync(at - elapsed - 1);
        expect(fetch).toHaveBeenCalledTimes(index + 1);
        await vi.advanceTimersByTimeAsync(1);
        expect(fetch).toHaveBeenCalledTimes(index + 2);
        elapsed = at;
      }
    };

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    });

    it("waits up to 300 ms before the first retry and up to 600 ms before the second", async () => {
      vi.spyOn(Math, "random").mockReturnValue(1);
      const fetch = replyInOrder(answer(503), answer(503), answer(200));
      const { client } = create(fetch);

      const sent = get(client);

      await expectAttemptsAt(fetch, [300, 900]);
      await expect(sent).resolves.toMatchObject({ ok: true, status: 200 });
    });

    it("scales each wait by a random factor", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const fetch = replyInOrder(answer(503), answer(503), answer(200));
      const { client } = create(fetch);

      const sent = get(client);

      await expectAttemptsAt(fetch, [150, 450]);
      await expect(sent).resolves.toMatchObject({ ok: true, status: 200 });
    });

    it("ignores Retry-After and keeps its own backoff", async () => {
      vi.spyOn(Math, "random").mockReturnValue(1);
      const retryAfter = String(faker.number.int({ min: 1, max: 3_600 }));
      const fetch = replyInOrder(
        answer(503, "", { "retry-after": retryAfter }),
        answer(200),
      );
      const { client } = create(fetch);

      const sent = get(client);

      await expectAttemptsAt(fetch, [300]);
      await expect(sent).resolves.toMatchObject({ ok: true, status: 200 });
    });
  });

  describe("deadline", () => {
    it("reports a timeout without retrying when an attempt takes longer than the limit", async () => {
      const fetch = hangs();
      const { client } = create(fetch, 10);

      const result = await get(client);

      expect(result).toStrictEqual({ ok: false, failure: "timeout" });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("reports a timeout when the deadline passes while waiting to retry", async () => {
      vi.spyOn(Math, "random").mockReturnValue(1);
      const fetch = replyInOrder(answer(503), answer(200));
      const { client } = create(fetch, 20);

      const result = await get(client);

      expect(result).toStrictEqual({ ok: false, failure: "timeout" });
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("reports a timeout when the body does not arrive within the limit", async () => {
      const fetch = vi.fn<typeof globalThis.fetch>((input) => {
        const { signal } = input as Request;
        const body = new ReadableStream({
          start(controller) {
            signal.addEventListener("abort", () =>
              controller.error(signal.reason),
            );
          },
        });
        return Promise.resolve(new Response(body));
      });
      const { client } = create(fetch, 10);

      const result = await get(client);

      expect(result).toStrictEqual({ ok: false, failure: "timeout" });
    });
  });
});
