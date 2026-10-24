import { HttpRoute } from "@shared/presentation/http/http-route";
import { HttpRouter } from "@shared/presentation/http/http-router";

import { IdentityModule } from "@/identity/identity.module";

export type ApplicationModules = {
  identity: IdentityModule;
};

/** Every HTTP route of the application, in the order an adapter must register them. */
export const createHttpRoutes = (
  modules: ApplicationModules,
): readonly HttpRoute<unknown>[] =>
  new HttpRouter()
    // Registration order is the access rule: every route added before `authenticate` is reachable without a token.
    .add(modules.identity.publicRoutes)
    .use(modules.identity.authenticate)
    .add(modules.identity.routes)
    .routes();
