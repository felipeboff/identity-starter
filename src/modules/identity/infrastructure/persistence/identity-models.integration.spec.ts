import { faker } from "@faker-js/faker";
import { useMemoryMongo } from "@shared/testing/memory-mongo";
import mongoose, { Types } from "mongoose";
import { beforeAll, describe, expect, it } from "vitest";

import { IdentityModels } from "./identity-models";

import { AuthProvider } from "@/identity/domain/credential.entity";
import {
  MembershipPermission,
  MembershipRole,
} from "@/identity/domain/membership.entity";
import { SessionRevocationReason } from "@/identity/domain/session.entity";

type ModelKey = Exclude<keyof IdentityModels, "ready">;

const objectId = () => new Types.ObjectId();
const tokenHash = () => faker.string.hexadecimal({ length: 64, prefix: "" });

const audit = () => ({
  version: 0,
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
});

const accountDocument = (email = faker.internet.email().toLowerCase()) => ({
  _id: objectId(),
  name: faker.person.fullName(),
  email,
  createdBy: objectId(),
  ...audit(),
});

const credentialDocument = (
  subject = faker.internet.email().toLowerCase(),
) => ({
  _id: objectId(),
  accountId: objectId(),
  provider: AuthProvider.EMAIL,
  subject,
  passwordHash: `$${faker.string.alphanumeric(40)}`,
  providerEmail: subject,
  ...audit(),
});

const membershipDocument = (accountId = objectId()) => ({
  _id: objectId(),
  accountId,
  role: MembershipRole.USER,
  permissions: [MembershipPermission.INVITATION_READ],
  createdBy: objectId(),
  ...audit(),
});

const sessionDocument = (hash = tokenHash()) => ({
  _id: objectId(),
  accountId: objectId(),
  credentialId: objectId(),
  membershipId: objectId(),
  tokenHash: hash,
  expiresAt: faker.date.future(),
  userAgent: faker.internet.userAgent(),
  ipAddress: faker.internet.ip(),
  version: 0,
  createdAt: faker.date.past(),
  revokedAt: null,
  acceptedByAccountId: null,
  revokedReason: null,
});

const tokenDocument = (hash = tokenHash()) => ({
  _id: objectId(),
  accountId: objectId(),
  tokenHash: hash,
  expiresAt: faker.date.future(),
  ...audit(),
});

const passwordResetDocument = (hash = tokenHash()) => ({
  ...tokenDocument(hash),
  credentialId: objectId(),
});

describe("IdentityModels", () => {
  const mongo = useMemoryMongo();
  let models: IdentityModels;

  beforeAll(async () => {
    models = new IdentityModels(mongo.connection());
    await models.ready();
  });

  it.each<[ModelKey, string]>([
    ["accounts", "accounts"],
    ["credentials", "credentials"],
    ["memberships", "memberships"],
    ["sessions", "sessions"],
    ["passwordResets", "password_resets"],
    ["emailVerifications", "email_verifications"],
  ])("stores %s in the %s collection", (key, collection) => {
    expect(models[key].collection.collectionName).toBe(collection);
  });

  it.each<[ModelKey, Record<string, 1>, boolean]>([
    ["accounts", { email: 1 }, true],
    ["credentials", { provider: 1, subject: 1 }, true],
    ["credentials", { accountId: 1 }, false],
    ["memberships", { accountId: 1 }, true],
    ["sessions", { tokenHash: 1 }, true],
    ["sessions", { accountId: 1, revokedAt: 1 }, false],
    ["passwordResets", { tokenHash: 1 }, true],
    ["passwordResets", { accountId: 1 }, false],
    ["emailVerifications", { tokenHash: 1 }, true],
    ["emailVerifications", { accountId: 1 }, false],
  ])("indexes %s on %o (unique: %s)", async (key, fields, unique) => {
    const indexes = await models[key].collection.indexes();

    expect(indexes).toContainEqual(
      expect.objectContaining({
        key: fields,
        ...(unique ? { unique: true } : {}),
      }),
    );
  });

  it.each<ModelKey>(["sessions", "passwordResets", "emailVerifications"])(
    "removes %s once their expiresAt passes",
    async (key) => {
      const indexes = await models[key].collection.indexes();

      expect(indexes).toContainEqual(
        expect.objectContaining({
          key: { expiresAt: 1 },
          expireAfterSeconds: 0,
        }),
      );
    },
  );

  it.each<[string, () => Promise<unknown>]>([
    [
      "an account with an email already taken",
      async () => {
        const email = faker.internet.email().toLowerCase();
        await models.accounts.create(accountDocument(email));
        return models.accounts.create(accountDocument(email));
      },
    ],
    [
      "a credential with the same provider and subject",
      async () => {
        const subject = faker.internet.email().toLowerCase();
        await models.credentials.create(credentialDocument(subject));
        return models.credentials.create(credentialDocument(subject));
      },
    ],
    [
      "a second membership for the same account",
      async () => {
        const accountId = objectId();
        await models.memberships.create(membershipDocument(accountId));
        return models.memberships.create(membershipDocument(accountId));
      },
    ],
    [
      "a session with a token hash already in use",
      async () => {
        const hash = tokenHash();
        await models.sessions.create(sessionDocument(hash));
        return models.sessions.create(sessionDocument(hash));
      },
    ],
    [
      "a password reset with a token hash already in use",
      async () => {
        const hash = tokenHash();
        await models.passwordResets.create(passwordResetDocument(hash));
        return models.passwordResets.create(passwordResetDocument(hash));
      },
    ],
    [
      "an email verification with a token hash already in use",
      async () => {
        const hash = tokenHash();
        await models.emailVerifications.create(tokenDocument(hash));
        return models.emailVerifications.create(tokenDocument(hash));
      },
    ],
  ])("refuses %s", async (_, insertTwice) => {
    await expect(insertTwice()).rejects.toMatchObject({ code: 11000 });
  });

  it.each<[ModelKey, string[]]>([
    [
      "accounts",
      [
        "_id",
        "name",
        "email",
        "createdBy",
        "version",
        "createdAt",
        "updatedAt",
      ],
    ],
    [
      "credentials",
      [
        "_id",
        "accountId",
        "provider",
        "subject",
        "version",
        "createdAt",
        "updatedAt",
      ],
    ],
    [
      "memberships",
      [
        "_id",
        "accountId",
        "role",
        "createdBy",
        "version",
        "createdAt",
        "updatedAt",
      ],
    ],
    [
      "sessions",
      [
        "_id",
        "accountId",
        "credentialId",
        "membershipId",
        "tokenHash",
        "expiresAt",
        "version",
        "createdAt",
      ],
    ],
    [
      "passwordResets",
      [
        "_id",
        "accountId",
        "credentialId",
        "tokenHash",
        "expiresAt",
        "version",
        "createdAt",
        "updatedAt",
      ],
    ],
    [
      "emailVerifications",
      [
        "_id",
        "accountId",
        "tokenHash",
        "expiresAt",
        "version",
        "createdAt",
        "updatedAt",
      ],
    ],
  ])("requires the fields of %s", (key, required) => {
    const Model = models[key] as mongoose.Model<unknown>;

    const error = new Model({}).validateSync();

    expect(Object.keys(error?.errors ?? {}).sort()).toStrictEqual(
      [...required].sort(),
    );
  });

  it.each<[string, ModelKey, Record<string, unknown>, string]>([
    [
      "an unknown provider",
      "credentials",
      { ...credentialDocument(), provider: faker.string.alpha(12) },
      "provider",
    ],
    [
      "an unknown role",
      "memberships",
      { ...membershipDocument(), role: faker.string.alpha(12) },
      "role",
    ],
    [
      "an unknown permission",
      "memberships",
      { ...membershipDocument(), permissions: [faker.string.alpha(12)] },
      "permissions.0",
    ],
    [
      "an unknown revocation reason",
      "sessions",
      { ...sessionDocument(), revokedReason: faker.string.alpha(12) },
      "revokedReason",
    ],
  ])("refuses %s", (_, key, document, path) => {
    const Model = models[key] as mongoose.Model<unknown>;

    const error = new Model(document).validateSync();

    expect(Object.keys(error?.errors ?? {})).toStrictEqual([path]);
  });

  it("accepts a session revoked for a known reason", () => {
    const error = new models.sessions({
      ...sessionDocument(),
      revokedAt: faker.date.recent(),
      revokedReason: SessionRevocationReason.LOGOUT,
    }).validateSync();

    expect(error).toBeUndefined();
  });

  it("gives back the same models when registered again on the same connection", () => {
    const again = new IdentityModels(mongo.connection());

    expect(again.accounts).toBe(models.accounts);
    expect(again.emailVerifications).toBe(models.emailVerifications);
  });
});
