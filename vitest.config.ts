import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src/modules"),
      "@shared": path.resolve(import.meta.dirname, "src/shared"),
      "@app": path.resolve(import.meta.dirname, "src/app"),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      // Measure every source file, not only the ones some test imports.
      include: ["src/**/*.ts"],
      // Entry point: two lines of wiring; `start` holds the logic and is tested.
      exclude: ["src/main.ts"],
      thresholds: { 100: true },
    },
  },
});
