import { faker } from "@faker-js/faker";
import { SignJWT, decodeJwt, decodeProtectedHeader } from "jose";
import { describe, expect, it } from "vitest";

import { ACCESS_TOKEN_TTL_MS } from "../application/session.policy";
import { FakeClock } from "../application/testing/fakes";

import { JoseAccessToken } from "./jose-access-token";

const buildSecret = () => faker.string.alphanumeric(64);

const buildClaims = () => ({
  accountId: faker.database.mongodbObjectId(),
  sessionId: faker.database.mongodbObjectId(),
});

const signRaw = (
  secret: string,
  payload: Record<string, unknown>,
  at: Date,
) => {
  const issuedAt = Math.floor(at.getTime() / 1000);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 60)
    .sign(new TextEncoder().encode(secret));
};

describe("JoseAccessToken", () => {
  const create = (secret = buildSecret(), clock = new FakeClock()) => ({
    accessToken: new JoseAccessToken({ secret, clock }),
    secret,
    clock,
  });

  describe("issue", () => {
    it("signs an HS256 JWT with sub, sid and a 15-minute expiry", async () => {
      const { accessToken, clock } = create();
      const claims = buildClaims();
      const issuedAt = Math.floor(clock.now().getTime() / 1000);

      const token = await accessToken.issue(claims);

      expect(decodeProtectedHeader(token)).toStrictEqual({
        alg: "HS256",
        typ: "JWT",
      });
      expect(decodeJwt(token)).toStrictEqual({
        sub: claims.accountId,
        sid: claims.sessionId,
        iat: issuedAt,
        exp: issuedAt + ACCESS_TOKEN_TTL_MS / 1000,
      });
    });
  });

  describe("verify", () => {
    it("returns the claims of a token it issued", async () => {
      const { accessToken } = create();
      const claims = buildClaims();
      const token = await accessToken.issue(claims);

      await expect(accessToken.verify(token)).resolves.toStrictEqual(claims);
    });

    it("still accepts the token right before it expires", async () => {
      const { accessToken, clock } = create();
      const claims = buildClaims();
      const token = await accessToken.issue(claims);
      clock.advance(ACCESS_TOKEN_TTL_MS - 1000);

      await expect(accessToken.verify(token)).resolves.toStrictEqual(claims);
    });

    it("returns null once the token has expired", async () => {
      const { accessToken, clock } = create();
      const token = await accessToken.issue(buildClaims());
      clock.advance(ACCESS_TOKEN_TTL_MS);

      await expect(accessToken.verify(token)).resolves.toBeNull();
    });

    it("returns null for a token signed with another secret", async () => {
      const { accessToken, clock } = create();
      const token = await create(buildSecret(), clock).accessToken.issue(
        buildClaims(),
      );

      await expect(accessToken.verify(token)).resolves.toBeNull();
    });

    it("returns null for a token whose payload was tampered with", async () => {
      const { accessToken } = create();
      const token = await accessToken.issue(buildClaims());
      const [header, , signature] = token.split(".");
      const forged = Buffer.from(
        JSON.stringify({ ...decodeJwt(token), sub: buildClaims().accountId }),
      ).toString("base64url");

      await expect(
        accessToken.verify(`${header}.${forged}.${signature}`),
      ).resolves.toBeNull();
    });

    it("returns null for a token with the alg set to none", async () => {
      const { accessToken } = create();
      const token = await accessToken.issue(buildClaims());
      const [, payload] = token.split(".");
      const header = Buffer.from(
        JSON.stringify({ alg: "none", typ: "JWT" }),
      ).toString("base64url");

      await expect(
        accessToken.verify(`${header}.${payload}.`),
      ).resolves.toBeNull();
    });

    it("returns null for something that is not a JWT", async () => {
      const { accessToken } = create();

      await expect(
        accessToken.verify(faker.string.alphanumeric(40)),
      ).resolves.toBeNull();
    });

    it.each([
      ["sub", { sid: faker.database.mongodbObjectId() }],
      ["sid", { sub: faker.database.mongodbObjectId() }],
    ])("returns null when %s is missing", async (_claim, payload) => {
      const { accessToken, secret, clock } = create();
      const token = await signRaw(secret, payload, clock.now());

      await expect(accessToken.verify(token)).resolves.toBeNull();
    });

    it.each([
      [
        "sub",
        {
          sub: faker.number.int({ min: 1 }),
          sid: faker.database.mongodbObjectId(),
        },
      ],
      [
        "sid",
        {
          sub: faker.database.mongodbObjectId(),
          sid: faker.number.int({ min: 1 }),
        },
      ],
    ])("returns null when %s is not a string", async (_claim, payload) => {
      const { accessToken, secret, clock } = create();
      const token = await signRaw(secret, payload, clock.now());

      await expect(accessToken.verify(token)).resolves.toBeNull();
    });
  });
});
