import { describe, expect, it } from "vitest";

import { createIdentityContext } from "./application/testing/identity-context";
import { assembleIdentityModule } from "./identity.module";
import { AccountRegisteredVia, IdentityEvent } from "./public";

describe("identity public API", () => {
  it("exposes the account registered event, which no identity consumer subscribes to yet", () => {
    const identity = assembleIdentityModule(createIdentityContext());

    expect(IdentityEvent.ACCOUNT_REGISTERED).toBe(
      "identity.account.registered",
    );
    expect(AccountRegisteredVia).toStrictEqual({
      SIGN_UP: "sign_up",
      OAUTH: "oauth",
      INVITATION: "invitation",
    });
    expect(identity.messageConsumers).toStrictEqual([]);
  });

  it("exposes the e-mail changed event", () => {
    expect(IdentityEvent.EMAIL_CHANGED).toBe("identity.email.changed");
  });
});
