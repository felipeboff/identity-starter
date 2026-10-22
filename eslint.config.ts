import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import boundaries from "eslint-plugin-boundaries";
import { importX } from "eslint-plugin-import-x";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist/**", "coverage/**"] },
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
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(\\.|@/|@shared/).*\\.[cm]?[jt]s$",
              message: "Remove the file extension from local imports.",
            },
          ],
        },
      ],
      "import-x/order": [
        "error",
        {
          pathGroups: [{ pattern: "{@,@shared}/**", group: "internal" }],
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
              // shared never depends on a module.
              from: { element: { type: "shared" } },
              allow: { to: { element: { type: "shared" } } },
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
);
