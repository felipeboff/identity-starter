import path from "node:path";

import { defineConfig } from "vitest/config";

const INTEGRATION = "src/**/*.integration.spec.ts";
const E2E = "src/**/*.e2e.spec.ts";

const LEVEL_SCOPES = {
  unit: [
    "src/modules/*/domain/**/*.ts",
    "src/modules/*/application/**/*.ts",
    "src/shared/domain/**/*.ts",
    "src/shared/application/**/*.ts",
    "src/shared/presentation/**/*.ts",
    "src/shared/types/**/*.ts",
    "src/modules/*/public.ts",
    "src/app/config.ts",
    "src/app/shutdown.ts",
  ],
  integration: [
    "src/modules/*/infrastructure/**/*.ts",
    "src/shared/infrastructure/**/*.ts",
    "src/modules/*/*.module.ts",
  ],
  e2e: [
    "src/modules/*/presentation/**/*.ts",
    "src/app/create-server.ts",
    "src/app/http-routes.ts",
    "src/app/permission-catalog.ts",
    "src/app/start.ts",
  ],
};

const level = process.env.COVERAGE_LEVEL as
  keyof typeof LEVEL_SCOPES | undefined;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src/modules"),
      "@shared": path.resolve(import.meta.dirname, "src/shared"),
      "@app": path.resolve(import.meta.dirname, "src/app"),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.spec.ts"],
          exclude: [INTEGRATION, E2E],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: [INTEGRATION],
          globalSetup: [
            "src/shared/testing/memory-databases.global-setup.ts",
            "src/shared/testing/rabbitmq.global-setup.ts",
          ],
        },
      },
      {
        extends: true,
        test: {
          name: "e2e",
          include: [E2E],
          globalSetup: [
            "src/shared/testing/route-statuses.global-setup.ts",
            "src/shared/testing/memory-databases.global-setup.ts",
            "src/shared/testing/rabbitmq.global-setup.ts",
          ],
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: level ? LEVEL_SCOPES[level] : ["src/**/*.ts"],
      exclude: [
        "src/main.ts",
        "src/**/*.global-setup.ts",
        "src/**/*.fixture.ts",
        ...(level ? ["src/**/testing/**"] : []),
      ],
      thresholds: { 100: true },
    },
  },
});
