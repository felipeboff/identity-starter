import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import boundaries from "eslint-plugin-boundaries";
import { importX } from "eslint-plugin-import-x";
import globals from "globals";
import tseslint from "typescript-eslint";

const NO_LOCAL_EXTENSION = {
  regex: "^(\\.|@/|@shared/).*\\.[cm]?[jt]s$",
  message: "Remove the file extension from local imports.",
};

const NO_TEST_HELPERS = {
  regex: "(^|/)testing(/|$)",
  message:
    "Production code must not import fakes or test helpers from a testing/ folder.",
};

const NO_REAL_IO_IN_UNIT_SPECS = {
  regex:
    "^(supertest|express|mongodb-memory-server|node:http|node:net)$|(^|/)testing/(memory-mongo|[\\w-]+-http)$",
  message:
    "A unit spec runs without I/O. Rename it to *.integration.spec.ts (a real dependency) or *.e2e.spec.ts (real HTTP).",
};

export default defineConfig(
  { ignores: ["dist/**", "coverage/**", ".data/**", "web/**"] },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { "import-x": importX },
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
    ],
    rules: {
      "no-restricted-imports": ["error", { patterns: [NO_LOCAL_EXTENSION] }],
      "import-x/order": [
        "error",
        {
          pathGroups: [{ pattern: "{@,@shared,@app}/**", group: "internal" }],
          "newlines-between": "always",
          alphabetize: { order: "asc" },
          named: true,
        },
      ],
    },
  },
  {
    // Bounded contexts: each folder in src/modules is a module; src/shared is the shared kernel.
    files: ["src/**/*.ts"],
    plugins: { boundaries },
    settings: {
      "import/resolver": {
        typescript: { alwaysTryTypes: true, project: "./tsconfig.json" },
      },
      "boundaries/elements": [
        { type: "shared", pattern: "src/shared" },
        { type: "module", pattern: "src/modules/*", capture: ["moduleName"] },
        { type: "app", pattern: "src" },
      ],
    },
    rules: {
      // Imports inside the same module (or inside shared) are always allowed.
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            {
              // A module may use shared, and other modules only through their public.ts.
              from: { element: { type: "module" } },
              allow: {
                to: [
                  { element: { type: "shared" } },
                  {
                    element: { type: "module", fileInternalPath: "public.ts" },
                  },
                ],
              },
            },
            {
              from: { element: { type: "app" } },
              allow: {
                to: [
                  { element: { type: "shared" } },
                  {
                    element: {
                      type: "module",
                      fileInternalPath: ["public.ts", "*.module.ts"],
                    },
                  },
                ],
              },
            },
            {
              // shared never depends on a module.
              from: { element: { type: "shared" } },
              allow: { to: { element: { type: "shared" } } },
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.ts"],
    ignores: ["**/*.spec.ts", "**/testing/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [NO_LOCAL_EXTENSION, NO_TEST_HELPERS] },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: 'ThrowStatement > NewExpression[callee.name!="AppError"]',
          message:
            "Throw an AppError with a definition from defineError instead.",
        },
        {
          selector:
            'CallExpression[callee.object.name="Promise"][callee.property.name="reject"] > NewExpression[callee.name!="AppError"]',
          message:
            "Reject with an AppError with a definition from defineError instead.",
        },
      ],
    },
  },
  {
    files: ["src/**/*.spec.ts"],
    ignores: ["**/*.integration.spec.ts", "**/*.e2e.spec.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [NO_REAL_IO_IN_UNIT_SPECS] },
      ],
    },
  },
  eslintConfigPrettier,
);
