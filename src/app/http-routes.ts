import { HttpRoute } from "@shared/presentation/http/http-route";
import { HttpRouter } from "@shared/presentation/http/http-router";

import { IdentityModule } from "@/identity/identity.module";

export type ApplicationModules = {
  identity: IdentityModule;
};

export const createHttpRoutes = (
  modules: ApplicationModules,
): readonly HttpRoute<unknown>[] =>
  new HttpRouter()
    .add(modules.identity.publicRoutes)
    .use(modules.identity.authenticate)
    .add(modules.identity.routes)
    .routes();
