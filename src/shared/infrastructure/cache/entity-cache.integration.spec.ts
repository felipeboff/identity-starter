import { setTimeout as sleep } from "node:timers/promises";

import { faker } from "@faker-js/faker";
import { FakeLogger } from "@shared/testing/fake-logger";
import { InMemoryTransactionRunner } from "@shared/testing/in-memory-transaction-runner";
import { useMemoryRedis } from "@shared/testing/memory-redis";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { RedisCache } from "../redis/redis-cache";
import { RedisConnection } from "../redis/redis-connection";

import { EntityCache, EntityLookup } from "./entity-cache";
import { FailOpenCache } from "./fail-open-cache";

type NoteEntry = Readonly<{ id: string; email: string }>;

type Note = Readonly<{
  id: Readonly<{ value: string }>;
  email: string;
  toSnapshot(): NoteEntry;
}>;

const toNote = (entry: NoteEntry): Note => ({
  id: { value: entry.id },
  email: entry.email,
  toSnapshot: () => entry,
});

const buildNote = () =>
  toNote({
    id: faker.database.mongodbObjectId(),
    email: faker.internet.email().toLowerCase(),
  });

const loadOf = (note: Note | null) => vi.fn(() => Promise.resolve(note));

const byEmail = (
  email: string,
  load: () => Promise<Note | null>,
): EntityLookup<Note> => ({
  index: "email",
  value: email,
  matches: (note) => note.email === email,
  load,
});

describe("EntityCache", () => {
  const redis = useMemoryRedis();
  let connection: RedisConnection;

  beforeAll(async () => {
    connection = new RedisConnection({
      url: redis.url(),
      logger: new FakeLogger(),
    });
    await connection.connect();
  });

  afterAll(async () => {
    await connection.close();
  });

  const create = (ttlMs = faker.number.int({ min: 10_000, max: 60_000 })) => {
    const transactions = new InMemoryTransactionRunner();
    const entities = new EntityCache<Note, NoteEntry>({
      cache: new FailOpenCache({
        cache: new RedisCache({ client: connection.client }),
        logger: new FakeLogger(),
      }),
      transactions,
      ttlMs,
      namespace: faker.string.alpha(8),
      restore: toNote,
    });
    return { entities, transactions };
  };

  describe("findById", () => {
    it("loads an entity once and then reads it from the cache", async () => {
      const { entities } = create();
      const note = buildNote();
      const load = loadOf(note);
      await entities.findById(note.id.value, load);

      const cached = await entities.findById(note.id.value, load);

      expect(cached?.toSnapshot()).toStrictEqual(note.toSnapshot());
      expect(load).toHaveBeenCalledOnce();
    });

    it("loads a missing entity on every read", async () => {
      const { entities } = create();
      const id = faker.database.mongodbObjectId();
      const load = loadOf(null);
      await entities.findById(id, load);

      const found = await entities.findById(id, load);

      expect(found).toBeNull();
      expect(load).toHaveBeenCalledTimes(2);
    });

    it("loads inside a transaction, past the cache", async () => {
      const { entities, transactions } = create();
      const note = buildNote();
      const load = loadOf(note);
      await entities.findById(note.id.value, load);

      await transactions.run(() => entities.findById(note.id.value, load));

      expect(load).toHaveBeenCalledTimes(2);
    });

    it("loads again once ttlMs is over", async () => {
      const ttlMs = faker.number.int({ min: 20, max: 50 });
      const { entities } = create(ttlMs);
      const note = buildNote();
      const load = loadOf(note);
      await entities.findById(note.id.value, load);
      await sleep(ttlMs + 50);

      await entities.findById(note.id.value, load);

      expect(load).toHaveBeenCalledTimes(2);
    });
  });

  describe("findBy", () => {
    it("loads an entity once and then reads it from the cache", async () => {
      const { entities } = create();
      const note = buildNote();
      const load = loadOf(note);
      await entities.findBy(byEmail(note.email, load));

      const cached = await entities.findBy(byEmail(note.email, load));

      expect(cached?.toSnapshot()).toStrictEqual(note.toSnapshot());
      expect(load).toHaveBeenCalledOnce();
    });

    it("keeps the entity found by index for reads by id", async () => {
      const { entities } = create();
      const note = buildNote();
      await entities.findBy(byEmail(note.email, loadOf(note)));
      const load = loadOf(note);

      await entities.findById(note.id.value, load);

      expect(load).not.toHaveBeenCalled();
    });

    it("loads a missing entity on every read", async () => {
      const { entities } = create();
      const email = faker.internet.email().toLowerCase();
      const load = loadOf(null);
      await entities.findBy(byEmail(email, load));

      const found = await entities.findBy(byEmail(email, load));

      expect(found).toBeNull();
      expect(load).toHaveBeenCalledTimes(2);
    });

    it("loads inside a transaction, past the cache", async () => {
      const { entities, transactions } = create();
      const note = buildNote();
      const load = loadOf(note);
      await entities.findBy(byEmail(note.email, load));

      await transactions.run(() => entities.findBy(byEmail(note.email, load)));

      expect(load).toHaveBeenCalledTimes(2);
    });

    it("loads again when the cached entity no longer matches the index", async () => {
      const { entities } = create();
      const note = buildNote();
      await entities.findBy(byEmail(note.email, loadOf(note)));
      const moved = toNote({
        ...note.toSnapshot(),
        email: `${faker.string.alpha(4)}${note.email}`,
      });
      entities.forget(moved);
      await entities.findById(moved.id.value, loadOf(moved));
      const load = loadOf(null);

      const found = await entities.findBy(byEmail(note.email, load));

      expect(found).toBeNull();
      expect(load).toHaveBeenCalledOnce();
    });
  });

  describe("forget", () => {
    it("makes the next read load the entity again", async () => {
      const { entities } = create();
      const note = buildNote();
      const load = loadOf(note);
      await entities.findBy(byEmail(note.email, load));
      entities.forget(note);

      await entities.findBy(byEmail(note.email, load));

      expect(load).toHaveBeenCalledTimes(2);
    });

    it("forgets once the transaction that asked for it commits", async () => {
      const { entities, transactions } = create();
      const note = buildNote();
      const load = loadOf(note);
      await entities.findById(note.id.value, load);
      await transactions.run(() => {
        entities.forget(note);
        return Promise.resolve();
      });

      await entities.findById(note.id.value, load);

      expect(load).toHaveBeenCalledTimes(2);
    });

    it("keeps the entity when the transaction that asked for it fails", async () => {
      const { entities, transactions } = create();
      const note = buildNote();
      const load = loadOf(note);
      const failure = new Error(faker.lorem.sentence());
      await entities.findById(note.id.value, load);
      await expect(
        transactions.run(() => {
          entities.forget(note);
          return Promise.reject(failure);
        }),
      ).rejects.toBe(failure);

      await entities.findById(note.id.value, load);

      expect(load).toHaveBeenCalledOnce();
    });
  });
});
