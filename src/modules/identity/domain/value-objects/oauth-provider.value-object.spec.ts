import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { IdentityError } from "../errors/identity.error";

import { OAuthProvider } from "./oauth-provider.value-object";

describe("OAuthProvider", () => {
  it.each(["google", "github", "apple"])("accepts %s", (provider) => {
    expect(OAuthProvider.create(provider).value).toBe(provider);
  });

  it.each([
    ["the e-mail provider", "email"],
    ["an unknown provider", faker.string.alpha(12)],
  ])("throws OAuthProviderNotSupported for %s", (_, provider) => {
    expect(() => OAuthProvider.create(provider)).toThrow(
      IdentityError.OAuthProviderNotSupported.code,
    );
  });
});
