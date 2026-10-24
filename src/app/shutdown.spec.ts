import { EventEmitter } from "node:events";

import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";

import { handleShutdownSignals } from "./shutdown";

const createProcess = () => {
  const emitter = new EventEmitter();
  const exit = vi.fn<(code: number) => void>();
  return {
    emitter,
    exit,
    process: { on: emitter.on.bind(emitter), exit },
  };
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("handleShutdownSignals", () => {
  it.each(["SIGTERM", "SIGINT"])(
    "stops and exits with the stop code on %s",
    async (signal) => {
      const code = faker.helpers.arrayElement([0, 1] as const);
      const stop = vi.fn(() => Promise.resolve(code));
      const { emitter, exit, process } = createProcess();
      handleShutdownSignals({ stop }, process);

      emitter.emit(signal);
      await flush();

      expect(stop).toHaveBeenCalledOnce();
      expect(exit).toHaveBeenCalledExactlyOnceWith(code);
    },
  );

  it("ignores a second signal during shutdown", async () => {
    const stop = vi.fn(() => Promise.resolve(0 as const));
    const { emitter, exit, process } = createProcess();
    handleShutdownSignals({ stop }, process);

    emitter.emit("SIGTERM");
    emitter.emit("SIGINT");
    await flush();

    expect(stop).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledOnce();
  });

  it("exits with 1 when stopping fails", async () => {
    const stop = vi.fn(() => Promise.reject(new Error(faker.lorem.sentence())));
    const { emitter, exit, process } = createProcess();
    handleShutdownSignals({ stop }, process);

    emitter.emit("SIGTERM");
    await flush();

    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("does nothing until a signal arrives", () => {
    const stop = vi.fn(() => Promise.resolve(0 as const));
    const { exit, process } = createProcess();

    handleShutdownSignals({ stop }, process);

    expect(stop).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
});
