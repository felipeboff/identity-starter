import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { createIdentityHttp } from "./identity-http";

import { AuthProvider } from "@/identity/domain/credential.entity";

describe("createIdentityHttp", () => {
  it("rejects a route identity does not declare", async () => {
    const http = createIdentityHttp();

    const path = `/${faker.lorem.slug()}`;

    await expect(http.call("GET", path)).rejects.toThrow(
      `No identity route GET ${path}`,
    );
  });

  it("answers 500 and reports an unexpected error", async () => {
    const http = createIdentityHttp();

    // The fake gateway rejects an unregistered code with a plain Error.
    const out = await http.call("POST", "/auth/oauth/:provider", {
      params: { provider: AuthProvider.GOOGLE },
      body: { code: faker.string.alphanumeric(20) },
    });

    expect(out.status).toBe(500);
    expect(http.reported).toStrictEqual([expect.any(Error)]);
  });

  it("signs in a seeded account with a token the routes accept", async () => {
    const http = createIdentityHttp();
    const ana = await http.signIn();

    const out = await http.call("GET", "/me", { token: ana.token });

    expect(out.status).toBe(200);
  });
});
