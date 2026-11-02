import { HttpRoute } from "@shared/presentation/http/http-route";
import { HttpRouter } from "@shared/presentation/http/http-router";
import {
  type OpenApiDocument,
  OpenApiGenerator,
  type OpenApiGeneratorDeps,
} from "@shared/presentation/http/open-api-generator";

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

export type OpenApiInfo = Omit<OpenApiGeneratorDeps, "authentication">;

export const createOpenApiDocument = (
  modules: ApplicationModules,
  info: OpenApiInfo,
): OpenApiDocument =>
  new OpenApiGenerator({
    ...info,
    authentication: modules.identity.authenticate,
  }).generate(createHttpRoutes(modules));
