import { faker } from "@faker-js/faker";
import { Inbound, Next } from "@shared/presentation/handler";
import { expectAppError } from "@shared/testing/expect-app-error";
import { FakeLogContext } from "@shared/testing/fake-log-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticateMiddleware } from "./authenticate.middleware";

import { Actor } from "@/identity/application/actor";
import {
  IdentityContext,
  createIdentityContext,
  seedAccount,
  seedSession,
} from "@/identity/application/testing/identity-context";
import { AuthenticateUseCase } from "@/identity/application/use-cases/authenticate.use-case";
import { IdentityError } from "@/identity/domain/errors/identity.error";

describe("AuthenticateMiddleware", () => {
  let ctx: IdentityContext;
  let authenticate: AuthenticateUseCase;
  let middleware: AuthenticateMiddleware;
  let logContext: FakeLogContext;

  beforeEach(() => {
    ctx = createIdentityContext();
    authenticate = new AuthenticateUseCase(ctx);
    logContext = new FakeLogContext();
    middleware = new AuthenticateMiddleware({ authenticate, logContext });
  });

  const buildInbound = (metadata: Inbound["metadata"]): Inbound => ({
    input: {},
    metadata,
    ip: faker.internet.ip(),
    actor: undefined,
  });

  it("hands the token's actor to next and returns what next returns", async () => {
    const ana = await seedAccount(ctx);
    const { session, actor } = await seedSession(ctx, ana);
    const token = await ctx.accessToken.issue({
      accountId: ana.accountId,
      sessionId: session.id.value,
    });
    const answer = faker.lorem.word();
    const next = vi.fn<Next<Actor>>().mockResolvedValue(answer);
    const inbound = buildInbound({ authorization: `Bearer ${token}` });

    const out = await middleware.handle(inbound, next);

    expect(out).toBe(answer);
    expect(next).toHaveBeenCalledExactlyOnceWith({ ...inbound, actor });
    expect(logContext.added).toStrictEqual([{ accountId: ana.accountId }]);
  });

  it.each([
    ["no authorization metadata", {}],
    [
      "a Basic authorization",
      { authorization: `Basic ${faker.string.alphanumeric(24)}` },
    ],
  ])(
    "refuses an inbound without a bearer token: %s",
    async (_, metadata: Inbound["metadata"]) => {
      const execute = vi.spyOn(authenticate, "execute");
      const next = vi.fn<Next<Actor>>();

      await expectAppError(
        middleware.handle(buildInbound(metadata), next),
        IdentityError.InvalidAccessToken,
      );

      expect(execute).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      expect(logContext.added).toStrictEqual([]);
    },
  );

  it("refuses a bearer token the use case does not accept", async () => {
    const next = vi.fn<Next<Actor>>();

    await expectAppError(
      middleware.handle(
        buildInbound({
          authorization: `Bearer ${faker.string.alphanumeric(40)}`,
        }),
        next,
      ),
      IdentityError.InvalidAccessToken,
    );

    expect(next).not.toHaveBeenCalled();
  });
});
