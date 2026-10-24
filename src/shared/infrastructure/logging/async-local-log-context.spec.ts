import { EventEmitter } from "node:events";

import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { AsyncLocalLogContext } from "./async-local-log-context";

describe("AsyncLocalLogContext", () => {
  it("has no fields outside run", () => {
    const context = new AsyncLocalLogContext();

    context.add({ accountId: faker.database.mongodbObjectId() });

    expect(context.get()).toBeUndefined();
  });

  it("keeps the fields of run across awaits, with what was added later", async () => {
    const context = new AsyncLocalLogContext();
    const requestId = faker.string.uuid();
    const accountId = faker.database.mongodbObjectId();

    const fields = await context.run({ requestId }, async () => {
      await Promise.resolve();
      context.add({ accountId });
      await Promise.resolve();
      return context.get();
    });

    expect(fields).toStrictEqual({ requestId, accountId });
  });

  it("isolates concurrent runs", async () => {
    const context = new AsyncLocalLogContext();
    const [first, second] = [faker.string.uuid(), faker.string.uuid()];

    const seen = await Promise.all(
      [first, second].map((requestId) =>
        context.run({ requestId }, async () => {
          await Promise.resolve();
          return context.get();
        }),
      ),
    );

    expect(seen).toStrictEqual([{ requestId: first }, { requestId: second }]);
  });

  it("returns a copy, so callers cannot change the context", () => {
    const context = new AsyncLocalLogContext();
    const requestId = faker.string.uuid();

    context.run({ requestId }, () => {
      const copy = context.get() as Record<string, unknown>;
      copy.requestId = faker.string.uuid();

      expect(context.get()).toStrictEqual({ requestId });
    });
  });

  it("runs a bound callback in the context it was bound in", () => {
    const context = new AsyncLocalLogContext();
    const emitter = new EventEmitter();
    const requestId = faker.string.uuid();
    const seen: unknown[] = [];

    context.run({ requestId }, () => {
      emitter.on(
        "done",
        context.bind(() => seen.push(context.get())),
      );
    });
    emitter.emit("done");

    expect(seen).toStrictEqual([{ requestId }]);
  });
});
