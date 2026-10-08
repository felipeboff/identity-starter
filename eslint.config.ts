import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import { importX } from "eslint-plugin-import-x";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist/**"] },
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
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
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
  eslintConfigPrettier,
);
