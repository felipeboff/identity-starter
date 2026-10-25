import { faker } from "@faker-js/faker";
import { SharedError } from "@shared/domain/errors/shared.error";
import { expectAppError } from "@shared/testing/expect-app-error";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose, {
  type Connection,
  type Model,
  Schema,
  Types,
  mongo,
} from "mongoose";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { OptimisticWriter } from "./optimistic-writer";

const STATUSES = ["active", "paused"] as const;

type ThingDocument = {
  _id: Types.ObjectId;
  code: string;
  status: (typeof STATUSES)[number];
  version: number;
};

const thingSchema = new Schema<ThingDocument>(
  {
    _id: { type: Schema.Types.ObjectId, required: true },
    code: { type: String, required: true, unique: true },
    status: { type: String, enum: STATUSES, required: true },
    version: { type: Number, required: true },
  },
  { versionKey: false },
);

const newThing = (overrides: Partial<ThingDocument> = {}): ThingDocument => ({
  _id: new Types.ObjectId(),
  code: faker.string.alphanumeric(16),
  status: "active",
  version: 0,
  ...overrides,
});

describe("OptimisticWriter", () => {
  let server: MongoMemoryServer;
  let connection: Connection;
  let things: Model<ThingDocument>;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    connection = await mongoose
      .createConnection(server.getUri(), {
        dbName: faker.string.alpha({ length: 12, casing: "lower" }),
      })
      .asPromise();
    things = connection.model<ThingDocument>("Thing", thingSchema);
    await things.syncIndexes();
  });

  afterAll(async () => {
    await connection.close();
    await server.stop();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const stored = (id: Types.ObjectId) => things.findById(id).lean();

  it("creates a new document at version 1", async () => {
    const thing = newThing();

    await new OptimisticWriter(things).save(thing);

    expect(await stored(thing._id)).toStrictEqual({ ...thing, version: 1 });
  });

  it("updates the stored version and bumps it", async () => {
    const thing = newThing();
    const writer = new OptimisticWriter(things);
    await writer.save(thing);

    await writer.save({ ...thing, status: "paused", version: 1 });

    expect(await stored(thing._id)).toStrictEqual({
      ...thing,
      status: "paused",
      version: 2,
    });
  });

  it("refuses an update made from a version that is no longer stored", async () => {
    const thing = newThing();
    const writer = new OptimisticWriter(things);
    await writer.save(thing);
    await writer.save({ ...thing, status: "paused", version: 1 });

    await expectAppError(
      writer.save({ ...thing, status: "active", version: 1 }),
      SharedError.VersionConflict,
      { id: thing._id.toHexString(), version: 1 },
    );

    expect(await stored(thing._id)).toMatchObject({
      status: "paused",
      version: 2,
    });
  });

  it("validates an update against the schema", async () => {
    const thing = newThing();
    const writer = new OptimisticWriter(things);
    await writer.save(thing);

    await expect(
      writer.save({
        ...thing,
        status: faker.string.alpha(12) as ThingDocument["status"],
        version: 1,
      }),
    ).rejects.toMatchObject({ name: "ValidationError" });

    expect(await stored(thing._id)).toMatchObject({ version: 1 });
  });

  describe("creating", () => {
    it("refuses a document whose id is already stored", async () => {
      const thing = newThing();
      const writer = new OptimisticWriter(things);
      await writer.save(thing);

      await expectAppError(
        writer.save({ ...thing, code: faker.string.alphanumeric(16) }),
        SharedError.AlreadyExists,
        { id: thing._id.toHexString() },
      );
    });

    it("lets a duplicate on another unique key through", async () => {
      const code = faker.string.alphanumeric(16);
      const writer = new OptimisticWriter(things);
      await writer.save(newThing({ code }));

      await expect(writer.save(newThing({ code }))).rejects.toMatchObject({
        code: 11000,
        keyPattern: { code: 1 },
      });
    });

    it("lets a duplicate key the server did not name through", async () => {
      const error = new mongo.MongoServerError({
        code: 11000,
        errmsg: faker.lorem.sentence(),
      });
      vi.spyOn(things.prototype, "save").mockRejectedValue(error);

      await expect(new OptimisticWriter(things).save(newThing())).rejects.toBe(
        error,
      );
    });

    it("validates a new document against the schema", async () => {
      await expect(
        new OptimisticWriter(things).save(
          newThing({
            status: faker.string.alpha(12) as ThingDocument["status"],
          }),
        ),
      ).rejects.toMatchObject({ name: "ValidationError" });
    });
  });
});
