import { faker } from "@faker-js/faker";
import { beforeEach, expect, it } from "vitest";

import { SessionRepository } from "../../ports/session.repository";

import {
  Session,
  SessionRevocationReason,
} from "@/identity/domain/session.entity";

const tokenHash = () => faker.string.hexadecimal({ length: 64, prefix: "" });

const registerSession = (
  accountId = faker.database.mongodbObjectId(),
  at = faker.date.past(),
) =>
  Session.register(
    {
      id: faker.database.mongodbObjectId(),
      accountId,
      credentialId: faker.database.mongodbObjectId(),
      membershipId: faker.database.mongodbObjectId(),
      tokenHash: tokenHash(),
      expiresAt: faker.date.future(),
      userAgent: faker.internet.userAgent(),
      ipAddress: faker.internet.ip(),
    },
    at,
  );

export const sessionRepositoryContract = (
  createRepository: () => SessionRepository,
) => {
  let sessions: SessionRepository;

  beforeEach(() => {
    sessions = createRepository();
  });

  const load = async (session: Session) =>
    (await sessions.findById(session.id.value)) as Session;

  it("keeps every field of an active session", async () => {
    const session = registerSession();

    await sessions.save(session);

    expect(session.version).toBe(1);
    expect((await load(session)).toSnapshot()).toStrictEqual(
      session.toSnapshot(),
    );
  });

  it("keeps the reason and the account of a revocation", async () => {
    const session = registerSession();
    await sessions.save(session);
    session.revoke(
      SessionRevocationReason.REPLACED,
      faker.date.recent(),
      faker.database.mongodbObjectId(),
    );

    await sessions.save(session);

    expect((await load(session)).toSnapshot()).toStrictEqual({
      ...session.toSnapshot(),
      version: 2,
    });
  });

  it("finds a session by its token hash", async () => {
    const session = registerSession();
    await sessions.save(session);

    const found = await sessions.findByTokenHash(
      session.toSnapshot().tokenHash,
    );

    expect(found?.id.value).toBe(session.id.value);
  });

  it("finds the active session of an account, not a revoked one", async () => {
    const accountId = faker.database.mongodbObjectId();
    const revoked = registerSession(accountId);
    revoked.revoke(SessionRevocationReason.LOGOUT, faker.date.recent());
    const active = registerSession(accountId);
    await sessions.save(revoked);
    await sessions.save(active);

    const found = await sessions.findByAccountId(accountId);

    expect(found?.id.value).toBe(active.id.value);
  });

  it("finds no active session when every session of the account is revoked", async () => {
    const accountId = faker.database.mongodbObjectId();
    const revoked = registerSession(accountId);
    revoked.revoke(SessionRevocationReason.LOGOUT, faker.date.recent());
    await sessions.save(revoked);

    expect(await sessions.findByAccountId(accountId)).toBeNull();
  });

  it.each([
    ["id", () => sessions.findById(faker.database.mongodbObjectId())],
    ["token hash", () => sessions.findByTokenHash(tokenHash())],
  ])("returns null for an unknown %s", async (_, find) => {
    expect(await find()).toBeNull();
  });

  it("lists every session of one account in creation order", async () => {
    const accountId = faker.database.mongodbObjectId();
    const createdAt = faker.date.past();
    const first = registerSession(accountId, createdAt);
    first.revoke(SessionRevocationReason.LOGOUT, faker.date.recent());
    const second = registerSession(
      accountId,
      new Date(createdAt.getTime() + 1_000),
    );
    await sessions.save(second);
    await sessions.save(registerSession());
    await sessions.save(first);

    const listed = await sessions.listByAccountId(accountId);

    expect(listed.map((session) => session.id.value)).toStrictEqual([
      first.id.value,
      second.id.value,
    ]);
  });

  it("lists nothing for an account with no sessions", async () => {
    expect(
      await sessions.listByAccountId(faker.database.mongodbObjectId()),
    ).toStrictEqual([]);
  });
};
