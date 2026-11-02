import { faker } from "@faker-js/faker";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { BasicAuth } from "./basic-auth";

const encode = (value: string) => Buffer.from(value).toString("base64");

describe("BasicAuth", () => {
  const realm = faker.internet.domainWord();
  const credentials = {
    username: faker.internet.username(),
    password: `${faker.internet.password({ length: 12 })}:${faker.internet.password({ length: 4 })}`,
  };
  const body = { [faker.lorem.word()]: faker.lorem.sentence() };
  const app = express()
    .use(new BasicAuth({ realm, credentials }).guard())
    .get("/", (_req, res) => {
      res.json(body);
    });

  const callWith = (authorization?: string) =>
    authorization === undefined
      ? request(app).get("/")
      : request(app).get("/").set("authorization", authorization);

  const expectChallenge = (response: request.Response) => {
    expect(response.status).toBe(401);
    expect(response.headers["www-authenticate"]).toBe(
      `Basic realm="${realm}", charset="UTF-8"`,
    );
    expect(response.text).toBe("");
  };

  it("lets the configured username and password through, even with a colon in the password", async () => {
    const response = await callWith(
      `Basic ${encode(`${credentials.username}:${credentials.password}`)}`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(body);
  });

  it("asks for credentials when the request brings none", async () => {
    expectChallenge(await callWith());
  });

  it.each([
    [
      "a wrong password",
      () => `${credentials.username}:${faker.internet.password()}`,
    ],
    [
      "a wrong username",
      () => `${faker.internet.username()}:${credentials.password}`,
    ],
    ["no colon", () => faker.string.alphanumeric(24)],
  ])("refuses %s", async (_case, pair) => {
    expectChallenge(await callWith(`Basic ${encode(pair())}`));
  });

  it("refuses another scheme", async () => {
    expectChallenge(
      await callWith(
        `Bearer ${encode(`${credentials.username}:${credentials.password}`)}`,
      ),
    );
  });
});
