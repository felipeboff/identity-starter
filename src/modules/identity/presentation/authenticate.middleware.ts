import { AppError } from "@shared/domain/errors/app-error";
import { Inbound, Middleware, Next } from "@shared/presentation/handler";

import { Actor } from "@/identity/application/actor";
import { AuthenticateUseCase } from "@/identity/application/use-cases/authenticate.use-case";
import { IdentityError } from "@/identity/domain/errors/identity.error";

const BEARER = "Bearer ";

export type AuthenticateMiddlewareDeps = {
  authenticate: AuthenticateUseCase;
};

export class AuthenticateMiddleware extends Middleware<{
  deps: AuthenticateMiddlewareDeps;
  nextActor: Actor;
}> {
  async handle(inbound: Inbound, next: Next<Actor>): Promise<unknown> {
    const header = inbound?.metadata?.authorization;
    if (typeof header !== "string" || !header?.startsWith(BEARER)) {
      throw new AppError(IdentityError.InvalidAccessToken);
    }

    const actor = await this.deps.authenticate.execute({
      accessToken: header.slice(BEARER.length),
    });
    return next({ ...inbound, actor });
  }
}
