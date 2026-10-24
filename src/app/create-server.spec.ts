import { faker } from "@faker-js/faker";
import { SharedError } from "@shared/domain/errors/shared.error";
import { FakeLogger } from "@shared/testing/fake-logger";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createServer } from "./create-server";

import {
  createIdentityModule,
  createInMemoryIdentityAdapters,
} from "@/identity/identity.module";

const createApp = (trustProxy = 0) =>
  createServer({
    modules: {
      identity: createIdentityModule(createInMemoryIdentityAdapters()),
    },
    logger: new FakeLogger(),
    trustProxy,
  });

const signUp = (app: ReturnType<typeof createApp>) =>
  request(app).post("/api/auth/sign-up").send({
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: faker.internet.password(),
  });

const sessionIpOf = async (
  app: ReturnType<typeof createApp>,
  accessToken: string,
) => {
  const response = await request(app)
    .get("/api/me/sessions")
    .set("authorization", `Bearer ${accessToken}`);
  const { sessions } = response.body as { sessions: { ipAddress: string }[] };
  return sessions[0]?.ipAddress;
};

describe("createServer", () => {
  it("serves the module routes under /api", async () => {
    const app = createApp();

    const response = await signUp(app);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      accessToken: expect.any(String) as unknown,
    });
  });

  it("answers with security and CORS headers", async () => {
    const app = createApp();

    const response = await signUp(app);

    expect(response.headers).toMatchObject({
      "x-content-type-options": "nosniff",
      "access-control-allow-origin": "*",
    });
    expect(response.headers).not.toHaveProperty("x-powered-by");
  });

  it("stores the forwarded client IP when it trusts the proxy", async () => {
    const app = createApp(1);
    const clientIp = faker.internet.ipv4();

    const response = await signUp(app).set("x-forwarded-for", clientIp);

    const { accessToken } = response.body as { accessToken: string };
    expect(await sessionIpOf(app, accessToken)).toBe(clientIp);
  });

  it("ignores x-forwarded-for when it trusts no proxy", async () => {
    const app = createApp(0);
    const clientIp = faker.internet.ipv4();

    const response = await signUp(app).set("x-forwarded-for", clientIp);

    const { accessToken } = response.body as { accessToken: string };
    expect(await sessionIpOf(app, accessToken)).not.toBe(clientIp);
  });

  it("answers a path outside the API with 404 problem details", async () => {
    const app = createApp();

    const response = await request(app).get(`/${faker.lorem.slug()}`);

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      code: SharedError.RouteNotFound.code,
    });
  });

  it("answers a malformed JSON body with 400 problem details", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/auth/sign-up")
      .set("content-type", "application/json")
      .send(`{${faker.lorem.word()}`);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: SharedError.BodyMalformed.code,
    });
  });
});
