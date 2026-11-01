import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";

import { faker } from "@faker-js/faker";
import { FakeSentryIngest } from "@shared/testing/fake-sentry-ingest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AsyncLocalLogContext } from "../logging/async-local-log-context";

import { SentryErrorReporter } from "./sentry-error-reporter";

type Crash = "exception" | "rejection";

const CRASH_FIXTURE = fileURLToPath(
  new URL("../../testing/sentry-crash.fixture.ts", import.meta.url),
);

const withinRequest = async (action: () => void, init: RequestInit = {}) => {
  const server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      action();
      res.end();
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  await fetch(`http://127.0.0.1:${port}/`, init);
  server.close();
};

const buildRequestFields = () => ({
  requestId: faker.string.uuid(),
  method: faker.helpers.arrayElement(["GET", "POST", "PATCH", "DELETE"]),
  route: `/${faker.lorem.word()}/:${faker.lorem.word()}`,
  operation: `${faker.lorem.word()}.${faker.lorem.word()}`,
});

describe("SentryErrorReporter", () => {
  let ingest: FakeSentryIngest;

  beforeEach(async () => {
    ingest = await FakeSentryIngest.start();
  });

  afterEach(async () => {
    await ingest.stop();
  });

  const create = () => {
    const context = new AsyncLocalLogContext();
    const environment = faker.lorem.word();
    const reporter = SentryErrorReporter.create({
      dsn: ingest.dsn,
      environment,
      context,
    });
    return { reporter, context, environment };
  };

  it("sends the exception, the environment and the request fields as tags", async () => {
    const { reporter, context, environment } = create();
    const fields = {
      ...buildRequestFields(),
      accountId: faker.database.mongodbObjectId(),
    };
    const error = new TypeError(faker.lorem.sentence());

    await withinRequest(() =>
      context.run(fields, () => reporter.report(error)),
    );
    await reporter.close();

    const events = ingest.events();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      environment,
      tags: fields,
      exception: { values: [{ type: "TypeError", value: error.message }] },
    });
    expect(
      events[0]?.exception?.values[0]?.stacktrace?.frames.length,
    ).toBeGreaterThan(0);
  });

  it("leaves accountId out of the tags when the request has no account", async () => {
    const { reporter, context } = create();
    const fields = buildRequestFields();

    await withinRequest(() =>
      context.run(fields, () =>
        reporter.report(new Error(faker.lorem.sentence())),
      ),
    );
    await reporter.close();

    const [event] = ingest.events();
    expect(event?.tags).toMatchObject(fields);
    expect(event?.tags).not.toHaveProperty("accountId");
  });

  it("sends an error reported outside a request without tags", async () => {
    const { reporter } = create();
    const error = new RangeError(faker.lorem.sentence());

    reporter.report(error);
    await reporter.close();

    const [event] = ingest.events();
    expect(event?.exception?.values[0]).toMatchObject({
      type: "RangeError",
      value: error.message,
    });
    expect(event?.tags ?? {}).toStrictEqual({});
  });

  it("sends neither the client IP, the headers, the body nor the e-mail", async () => {
    const { reporter, context } = create();
    const token = faker.string.alphanumeric(48);
    const ip = faker.internet.ipv4();
    const bodyEmail = faker.internet.email();
    const password = faker.internet.password({ length: 24 });
    const contextEmail = faker.internet.email();

    await withinRequest(
      () =>
        context.run({ ...buildRequestFields(), email: contextEmail }, () =>
          reporter.report(new Error(faker.lorem.sentence())),
        ),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "x-forwarded-for": ip,
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: bodyEmail, password }),
      },
    );
    await reporter.close();

    const raw = ingest.raw();
    expect(ingest.events()).toHaveLength(1);
    expect(raw).not.toContain(token);
    expect(raw).not.toContain(ip);
    expect(raw).not.toContain(bodyEmail);
    expect(raw).not.toContain(password);
    expect(raw).not.toContain(contextEmail);
  });

  describe("process crashes", () => {
    const runCrash = (crash: Crash, message: string) =>
      new Promise<number | null>((resolve) => {
        const child = spawn(
          process.execPath,
          ["--import", "tsx", CRASH_FIXTURE, ingest.dsn, crash, message],
          { stdio: "ignore" },
        );
        child.on("exit", (code) => resolve(code));
      });

    const reportedMessages = () =>
      ingest.events().map((event) => event.exception?.values[0]?.value);

    it("reports an uncaught exception and exits with code 1", async () => {
      const message = faker.lorem.sentence();

      const code = await runCrash("exception", message);

      expect(code).toBe(1);
      expect(reportedMessages()).toStrictEqual([message]);
    }, 20_000);

    it("reports an unhandled rejection and exits with code 1", async () => {
      const message = faker.lorem.sentence();

      const code = await runCrash("rejection", message);

      expect(code).toBe(1);
      expect(reportedMessages()).toStrictEqual([message]);
    }, 20_000);
  });
});
