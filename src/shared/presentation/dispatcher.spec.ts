import { faker } from "@faker-js/faker";
import Type, { type TSchema } from "typebox";
import { describe, expect, it } from "vitest";

import { SharedError } from "../domain/errors/shared.error";
import { expectAppError } from "../testing/expect-app-error";

import { Dispatcher } from "./dispatcher";
import { Entry, Handler, Inbound, Middleware, Next } from "./handler";
import { SchemaParser } from "./schema-parser";

type TestActor = { accountId: string };

const buildInbound = (overrides: Partial<Inbound> = {}): Inbound => ({
  input: {},
  metadata: { "user-agent": faker.internet.userAgent() },
  ip: faker.internet.ip(),
  actor: undefined,
  ...overrides,
});

const echoOutput = Type.Union([Type.String(), Type.Undefined()]);

class EchoHandler extends Handler<{
  deps: { received: Inbound<unknown>[]; output?: string };
  actor: unknown;
  output: typeof echoOutput;
}> {
  readonly name = `${faker.lorem.word()}.${faker.lorem.word()}`;
  readonly output = echoOutput;

  handle(inbound: Inbound<unknown>): Promise<string | undefined> {
    this.deps.received.push(inbound);
    return Promise.resolve(this.deps.output);
  }
}

type InputHandlerDeps<S extends TSchema> = {
  schema: S;
  received: unknown[];
};

class InputHandler<S extends TSchema> extends Handler<{
  deps: InputHandlerDeps<S>;
  actor: unknown;
  input: S;
}> {
  readonly name = `${faker.lorem.word()}.${faker.lorem.word()}`;
  readonly input = this.deps.schema;

  handle(inbound: Inbound<unknown, Type.StaticDecode<S>>): Promise<undefined> {
    this.deps.received.push(inbound.input);
    return Promise.resolve(undefined);
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
  const dispatcher = new Dispatcher({ parser: new SchemaParser() });

  it("passes the inbound to the handler and returns its output", async () => {
    const received: Inbound<unknown>[] = [];
    const output = faker.lorem.word();
    const inbound = buildInbound();

    const out = await dispatcher.dispatch(
      { handler: new EchoHandler({ received, output }) },
      inbound,
    );

    expect(out).toBe(output);
    expect(received).toStrictEqual([inbound]);
  });

  it("runs the middlewares in order before the handler", async () => {
    const calls: string[] = [];
    const received: Inbound<unknown>[] = [];
    const first = faker.lorem.word();
    const second = faker.lorem.word();
    const entry: Entry<unknown> = {
      middlewares: [
        new RecordingMiddleware({ name: first, calls }),
        new RecordingMiddleware({ name: second, calls }),
      ],
      handler: new EchoHandler({ received }),
    };

    await dispatcher.dispatch(entry, buildInbound());

    expect(calls).toStrictEqual([first, second]);
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

  describe("input", () => {
    const ageSchema = Type.Object({ age: Type.Integer() });

    it("hands the handler the input converted by its schema", async () => {
      const received: unknown[] = [];
      const age = faker.number.int({ min: 1, max: 120 });

      await dispatcher.dispatch(
        { handler: new InputHandler({ schema: ageSchema, received }) },
        buildInbound({
          input: { age: String(age), [faker.string.alpha(12)]: 1 },
        }),
      );

      expect(received).toStrictEqual([{ age }]);
    });

    it("fills the defaults the schema declares", async () => {
      const received: unknown[] = [];
      const fallback = faker.lorem.word();
      const schema = Type.Object({ role: Type.String({ default: fallback }) });

      await dispatcher.dispatch(
        { handler: new InputHandler({ schema, received }) },
        buildInbound({ input: {} }),
      );

      expect(received).toStrictEqual([{ role: fallback }]);
    });

    it("decodes the codecs the schema declares", async () => {
      const received: unknown[] = [];
      const address = faker.internet.url();
      const schema = Type.Object({
        site: Type.Codec(Type.String({ format: "url" }))
          .Decode((value) => new URL(value))
          .Encode((url) => url.href),
      });

      await dispatcher.dispatch(
        { handler: new InputHandler({ schema, received }) },
        buildInbound({ input: { site: address } }),
      );

      expect(received).toStrictEqual([{ site: new URL(address) }]);
    });

    it("refuses an input the schema does not accept without calling the handler", async () => {
      const received: unknown[] = [];

      await expectAppError(
        dispatcher.dispatch(
          { handler: new InputHandler({ schema: ageSchema, received }) },
          buildInbound({ input: { age: faker.lorem.word() } }),
        ),
        SharedError.InputInvalid,
        { violations: [{ field: "age", reason: "type" }] },
      );
      expect(received).toStrictEqual([]);
    });

    it("propagates a middleware error before reading the input", async () => {
      const error = new Error(faker.lorem.sentence());
      const received: unknown[] = [];

      await expect(
        dispatcher.dispatch(
          {
            middlewares: [new ThrowingMiddleware({ error })],
            handler: new InputHandler({ schema: ageSchema, received }),
          },
          buildInbound({ input: { age: faker.lorem.word() } }),
        ),
      ).rejects.toBe(error);
      expect(received).toStrictEqual([]);
    });

    it("hands an empty object to a handler with no input", async () => {
      const received: Inbound<unknown>[] = [];

      await dispatcher.dispatch(
        { handler: new EchoHandler({ received }) },
        buildInbound({ input: { name: faker.person.fullName() } }),
      );

      expect(received.map((inbound) => inbound.input)).toStrictEqual([{}]);
    });
  });
});
