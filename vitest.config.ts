import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src/modules"),
      "@shared": path.resolve(import.meta.dirname, "src/shared"),
    },
  },
  test: {
    coverage: {
      provider: "v8",
    },
  },
});
