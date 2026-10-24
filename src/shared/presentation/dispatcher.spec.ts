import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { Dispatcher } from "./dispatcher";
import { Entry, Handler, Inbound, Middleware, Next } from "./handler";

type TestActor = { accountId: string };

const buildInbound = (overrides: Partial<Inbound> = {}): Inbound => ({
  input: { name: faker.person.fullName() },
  metadata: { "user-agent": faker.internet.userAgent() },
  ip: faker.internet.ip(),
  actor: undefined,
  ...overrides,
});

class EchoHandler extends Handler<{
  deps: { received: Inbound<unknown>[] };
  actor: unknown;
  output: string;
}> {
  handle(inbound: Inbound<unknown>): Promise<string> {
    this.deps.received.push(inbound);
    return Promise.resolve("handled");
  }
}

class RecordingMiddleware extends Middleware<{
  deps: { name: string; calls: string[] };
}> {
  async handle(inbound: Inbound, next: Next): Promise<unknown> {
    this.deps.calls.push(this.deps.name);
    return next(inbound);
  }
}

class SetActorMiddleware extends Middleware<{
  deps: { actor: TestActor };
  nextActor: TestActor;
}> {
  async handle(inbound: Inbound, next: Next<TestActor>): Promise<unknown> {
    return next({ ...inbound, actor: this.deps.actor });
  }
}

class AnsweringMiddleware extends Middleware<{ deps: { answer: string } }> {
  handle(): Promise<unknown> {
    return Promise.resolve(this.deps.answer);
  }
}

class ThrowingMiddleware extends Middleware<{ deps: { error: Error } }> {
  handle(): Promise<unknown> {
    throw this.deps.error;
  }
}

describe("Dispatcher", () => {
  const dispatcher = new Dispatcher();

  it("passes the inbound to the handler and returns its output", async () => {
    const received: Inbound<unknown>[] = [];
    const inbound = buildInbound();

    const out = await dispatcher.dispatch(
      { handler: new EchoHandler({ received }) },
      inbound,
    );

    expect(out).toBe("handled");
    expect(received).toStrictEqual([inbound]);
  });

  it("runs the middlewares in order before the handler", async () => {
    const calls: string[] = [];
    const received: Inbound<unknown>[] = [];
    const entry: Entry<unknown> = {
      middlewares: [
        new RecordingMiddleware({ name: "first", calls }),
        new RecordingMiddleware({ name: "second", calls }),
      ],
      handler: new EchoHandler({ received }),
    };

    await dispatcher.dispatch(entry, buildInbound());

    expect(calls).toStrictEqual(["first", "second"]);
    expect(received).toHaveLength(1);
  });

  it("hands the inbound a middleware changed to the handler", async () => {
    const actor: TestActor = { accountId: faker.database.mongodbObjectId() };
    const received: Inbound<unknown>[] = [];
    const inbound = buildInbound();

    await dispatcher.dispatch(
      {
        middlewares: [new SetActorMiddleware({ actor })],
        handler: new EchoHandler({ received }),
      },
      inbound,
    );

    expect(received).toStrictEqual([{ ...inbound, actor }]);
  });

  it("returns a middleware's answer without calling the handler", async () => {
    const answer = faker.lorem.word();
    const received: Inbound<unknown>[] = [];

    const out = await dispatcher.dispatch(
      {
        middlewares: [new AnsweringMiddleware({ answer })],
        handler: new EchoHandler({ received }),
      },
      buildInbound(),
    );

    expect(out).toBe(answer);
    expect(received).toStrictEqual([]);
  });

  it("rejects with what a middleware throws, even synchronously", async () => {
    const error = new Error(faker.lorem.sentence());
    const received: Inbound<unknown>[] = [];

    await expect(
      dispatcher.dispatch(
        {
          middlewares: [new ThrowingMiddleware({ error })],
          handler: new EchoHandler({ received }),
        },
        buildInbound(),
      ),
    ).rejects.toBe(error);
    expect(received).toStrictEqual([]);
  });
});
