import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";

import { SharedError } from "../domain/errors/shared.error";

import { expectAppError } from "./expect-app-error";
import { InMemoryTransactionRunner } from "./in-memory-transaction-runner";

describe("InMemoryTransactionRunner", () => {
  it("resolves with the value and runs the after-commit callbacks once", async () => {
    const transactions = new InMemoryTransactionRunner();
    const callback = vi.fn();
    const rollback = vi.fn();
    const value = faker.number.int();
    let calledInside: number | undefined;

    const result = await transactions.run(() => {
      transactions.afterCommit(callback);
      transactions.onRollback(rollback);
      calledInside = callback.mock.calls.length;
      return Promise.resolve(value);
    });

    expect(result).toBe(value);
    expect(calledInside).toBe(0);
    expect(callback).toHaveBeenCalledOnce();
    expect(rollback).not.toHaveBeenCalled();
  });

  it("runs the rollbacks in reverse order when the work throws", async () => {
    const transactions = new InMemoryTransactionRunner();
    const callback = vi.fn();
    const undone: number[] = [];
    const failure = new Error(faker.lorem.sentence());

    await expect(
      transactions.run(() => {
        transactions.onRollback(() => undone.push(1));
        transactions.afterCommit(callback);
        transactions.onRollback(() => undone.push(2));
        return Promise.reject(failure);
      }),
    ).rejects.toBe(failure);

    expect(undone).toStrictEqual([2, 1]);
    expect(callback).not.toHaveBeenCalled();
  });

  it("runs an after-commit callback at once and skips a rollback outside a run", () => {
    const transactions = new InMemoryTransactionRunner();
    const callback = vi.fn();
    const rollback = vi.fn();

    transactions.afterCommit(callback);
    transactions.onRollback(rollback);

    expect(callback).toHaveBeenCalledOnce();
    expect(rollback).not.toHaveBeenCalled();
  });

  it("refuses a run inside a run", async () => {
    const transactions = new InMemoryTransactionRunner();
    const rollback = vi.fn();

    await expectAppError(
      transactions.run(async () => {
        transactions.onRollback(rollback);
        await transactions.run(() => Promise.resolve());
      }),
      SharedError.NestedTransaction,
    );

    expect(rollback).toHaveBeenCalledOnce();
  });

  it("tells whether a run is in progress", async () => {
    const transactions = new InMemoryTransactionRunner();
    let inside: boolean | undefined;

    await transactions.run(() => {
      inside = transactions.isRunning();
      return Promise.resolve();
    });

    expect(inside).toBe(true);
    expect(transactions.isRunning()).toBe(false);
  });
});
