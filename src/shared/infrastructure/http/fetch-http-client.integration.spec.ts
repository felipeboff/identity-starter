import { faker } from "@faker-js/faker";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FetchHttpClient } from "./fetch-http-client";

const respondWith = (body: string, status = 200) =>
  vi.fn<typeof globalThis.fetch>(() =>
    Promise.resolve(new Response(body, { status })),
  );

const lastInit = (fetch: ReturnType<typeof respondWith>) =>
  fetch.mock.calls.at(-1)?.[1];

const buildTimeout = () => faker.number.int({ min: 1_000, max: 10_000 });

describe("FetchHttpClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the method, URL and headers, without a body when there is none", async () => {
    const fetch = respondWith("");
    const client = new FetchHttpClient({ timeoutMs: buildTimeout(), fetch });
    const url = faker.internet.url();
    const authorization = `Bearer ${faker.string.alphanumeric(32)}`;

    await client.send({ method: "GET", url, headers: { authorization } });

    expect(fetch.mock.calls[0]?.[0]).toBe(url);
    expect(lastInit(fetch)).toMatchObject({
      method: "GET",
      headers: { authorization },
      body: undefined,
    });
    expect(lastInit(fetch)?.signal).toBeInstanceOf(AbortSignal);
  });

  it("encodes a JSON body", async () => {
    const fetch = respondWith("");
    const client = new FetchHttpClient({ timeoutMs: buildTimeout(), fetch });
    const json = { name: faker.person.fullName(), tags: [faker.lorem.word()] };

    await client.send({
      method: "POST",
      url: faker.internet.url(),
      body: { json },
    });

    expect(lastInit(fetch)).toMatchObject({
      headers: { "content-type": "application/json" },
      body: JSON.stringify(json),
    });
  });

  it("encodes a form body", async () => {
    const fetch = respondWith("");
    const client = new FetchHttpClient({ timeoutMs: buildTimeout(), fetch });
    const form = {
      code: faker.string.alphanumeric(20),
      name: faker.person.fullName(),
    };

    await client.send({
      method: "POST",
      url: faker.internet.url(),
      body: { form },
    });

    expect(lastInit(fetch)).toMatchObject({
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    });
  });

  it("lets the caller's headers win over the content type", async () => {
    const fetch = respondWith("");
    const client = new FetchHttpClient({ timeoutMs: buildTimeout(), fetch });
    const contentType = `application/${faker.lorem.word()}+json`;

    await client.send({
      method: "POST",
      url: faker.internet.url(),
      headers: { "content-type": contentType },
      body: { json: {} },
    });

    expect(lastInit(fetch)).toMatchObject({
      headers: { "content-type": contentType },
    });
  });

  it("returns the status and the JSON body", async () => {
    const body = { id: faker.number.int(), email: faker.internet.email() };
    const status = faker.helpers.arrayElement([200, 201, 400, 401, 500]);
    const client = new FetchHttpClient({
      timeoutMs: buildTimeout(),
      fetch: respondWith(JSON.stringify(body), status),
    });

    const result = await client.send({
      method: "GET",
      url: faker.internet.url(),
    });

    expect(result).toStrictEqual({ ok: true, status, body });
  });

  it("returns a null body when the response is empty", async () => {
    const client = new FetchHttpClient({
      timeoutMs: buildTimeout(),
      fetch: respondWith("", 202),
    });

    const result = await client.send({
      method: "GET",
      url: faker.internet.url(),
    });

    expect(result).toStrictEqual({ ok: true, status: 202, body: null });
  });

  it("returns the raw text when the body is not JSON", async () => {
    const text = `<p>${faker.lorem.sentence()}</p>`;
    const client = new FetchHttpClient({
      timeoutMs: buildTimeout(),
      fetch: respondWith(text, 502),
    });

    const result = await client.send({
      method: "GET",
      url: faker.internet.url(),
    });

    expect(result).toStrictEqual({ ok: true, status: 502, body: text });
  });

  it("reports a timeout when the request takes longer than the limit", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason as Error),
          );
        }),
    );
    const client = new FetchHttpClient({ timeoutMs: 10, fetch });

    const result = await client.send({
      method: "GET",
      url: faker.internet.url(),
    });

    expect(result).toStrictEqual({ ok: false, failure: "timeout" });
  });

  it("reports a network failure when fetch rejects for any other reason", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() =>
      Promise.reject(new TypeError(faker.lorem.sentence())),
    );
    const client = new FetchHttpClient({ timeoutMs: buildTimeout(), fetch });

    const result = await client.send({
      method: "GET",
      url: faker.internet.url(),
    });

    expect(result).toStrictEqual({ ok: false, failure: "network" });
  });

  it("uses the global fetch when none is given", async () => {
    const fetch = respondWith("");
    vi.stubGlobal("fetch", fetch);
    const client = new FetchHttpClient({ timeoutMs: buildTimeout() });
    const url = faker.internet.url();

    await client.send({ method: "GET", url });

    expect(fetch.mock.calls[0]?.[0]).toBe(url);
  });
});
