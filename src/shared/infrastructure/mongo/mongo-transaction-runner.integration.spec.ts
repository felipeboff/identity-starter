import { faker } from "@faker-js/faker";
import { useMemoryMongo } from "@shared/testing/memory-mongo";
import { type Model, Schema, Types, mongo } from "mongoose";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { MongoTransactionRunner } from "./mongo-transaction-runner";

type NoteDocument = { _id: Types.ObjectId; text: string };

const noteSchema = new Schema<NoteDocument>(
  { _id: { type: Schema.Types.ObjectId, required: true }, text: String },
  { versionKey: false },
);

const newNote = (): NoteDocument => ({
  _id: new Types.ObjectId(),
  text: faker.lorem.sentence(),
});

describe("MongoTransactionRunner", () => {
  const database = useMemoryMongo();
  let notes: Model<NoteDocument>;
  let drafts: Model<NoteDocument>;
  let transactions: MongoTransactionRunner;

  beforeAll(async () => {
    const connection = database.connection();
    notes = connection.model<NoteDocument>("Note", noteSchema);
    drafts = connection.model<NoteDocument>("Draft", noteSchema);
    await Promise.all([notes.createCollection(), drafts.createCollection()]);
    transactions = new MongoTransactionRunner(connection);
  });

  const stored = (model: Model<NoteDocument>, note: NoteDocument) =>
    model.findById(note._id).lean();

  it("keeps every write of a work that resolves", async () => {
    const note = newNote();
    const draft = newNote();
    const value = faker.number.int();

    const result = await transactions.run(async () => {
      await notes.create(note);
      await drafts.create(draft);
      return value;
    });

    expect(result).toBe(value);
    expect(await stored(notes, note)).toStrictEqual(note);
    expect(await stored(drafts, draft)).toStrictEqual(draft);
  });

  it("undoes every write of a work that throws", async () => {
    const existing = newNote();
    await drafts.create(existing);
    const note = newNote();
    const failure = new Error(faker.lorem.sentence());

    await expect(
      transactions.run(async () => {
        await notes.create(note);
        await drafts.updateOne(
          { _id: existing._id },
          { text: faker.lorem.sentence() },
        );
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(await stored(notes, note)).toBeNull();
    expect(await stored(drafts, existing)).toStrictEqual(existing);
  });

  it("runs the after-commit callbacks once, after the commit", async () => {
    const callback = vi.fn();
    let calledInside: number | undefined;

    await transactions.run(async () => {
      transactions.afterCommit(callback);
      await notes.create(newNote());
      calledInside = callback.mock.calls.length;
    });

    expect(calledInside).toBe(0);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("drops the after-commit callbacks of a work that throws", async () => {
    const callback = vi.fn();
    const failure = new Error(faker.lorem.sentence());

    await expect(
      transactions.run(() => {
        transactions.afterCommit(callback);
        return Promise.reject(failure);
      }),
    ).rejects.toBe(failure);

    expect(callback).not.toHaveBeenCalled();
  });

  it("keeps only the last attempt when the driver retries", async () => {
    const note = newNote();
    const callback = vi.fn();
    const work = vi.fn(async () => {
      await notes.create(note);
      transactions.afterCommit(callback);
      if (work.mock.calls.length === 1) {
        throw new mongo.MongoServerError({
          errmsg: faker.lorem.sentence(),
          errorLabels: ["TransientTransactionError"],
        });
      }
    });

    await transactions.run(work);

    expect(work).toHaveBeenCalledTimes(2);
    expect(await notes.countDocuments({ _id: note._id })).toBe(1);
    expect(callback).toHaveBeenCalledOnce();
  });

  it("joins the outer transaction when a run starts inside a run: its writes roll back with the outer one", async () => {
    const outer = newNote();
    const inner = newNote();
    const failure = new Error(faker.lorem.sentence());

    await expect(
      transactions.run(async () => {
        await notes.create(outer);
        await transactions.run(async () => {
          await notes.create(inner);
        });
        throw failure;
      }),
    ).rejects.toBe(failure);

    expect(await stored(notes, outer)).toBeNull();
    expect(await stored(notes, inner)).toBeNull();
  });

  it("joins the outer transaction when a run starts inside a run: its after-commit callback waits for the outer commit", async () => {
    const inner = newNote();
    const callback = vi.fn();
    let calledBeforeOuterEnded = false;

    await transactions.run(async () => {
      await transactions.run(async () => {
        await notes.create(inner);
        transactions.afterCommit(callback);
      });
      calledBeforeOuterEnded = callback.mock.calls.length > 0;
    });

    expect(calledBeforeOuterEnded).toBe(false);
    expect(callback).toHaveBeenCalledOnce();
    expect(await stored(notes, inner)).not.toBeNull();
  });

  it("runs an after-commit callback at once outside a run", () => {
    const callback = vi.fn();

    transactions.afterCommit(callback);

    expect(callback).toHaveBeenCalledOnce();
  });

  it("tells whether a run is in progress", async () => {
    let inside: boolean | undefined;

    await transactions.run(() => {
      inside = transactions.isRunning();
      return Promise.resolve();
    });

    expect(inside).toBe(true);
    expect(transactions.isRunning()).toBe(false);
  });
});
