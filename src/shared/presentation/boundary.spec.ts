import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const interfacesDir = import.meta.dirname;
const sharedDir = path.resolve(interfacesDir, "..");

const sourceFiles = readdirSync(interfacesDir, {
  recursive: true,
  encoding: "utf8",
})
  .filter((file) => file.endsWith(".ts") && !file.endsWith(".spec.ts"))
  .sort();

const importsOf = (file: string): string[] =>
  [
    ...readFileSync(path.join(interfacesDir, file), "utf8").matchAll(
      /(?:from|import)\s*\(?\s*"([^"]+)"/g,
    ),
  ].map((match) => match[1] ?? "");

const staysInShared = (file: string, specifier: string): boolean =>
  specifier.startsWith("@shared/") ||
  (specifier.startsWith(".") &&
    path
      .resolve(interfacesDir, path.dirname(file), specifier)
      .startsWith(sharedDir + path.sep));

describe("src/shared/presentation", () => {
  it("imports nothing outside src/shared and typebox, so it stays transport and framework neutral", () => {
    expect(sourceFiles).toStrictEqual([
      "date.schema.ts",
      "dispatcher.ts",
      "handler.ts",
      path.join("http", "http-error-mapper.ts"),
      path.join("http", "http-response.ts"),
      path.join("http", "http-route.ts"),
      path.join("http", "http-router.ts"),
      path.join("http", "open-api-generator.ts"),
      path.join("messaging", "message-consumer-adapter.ts"),
      path.join("messaging", "message-consumer.ts"),
      path.join("outbox", "outbox-consumer-adapter.ts"),
      path.join("outbox", "outbox-consumer.ts"),
      "page-request.schema.ts",
      "rate-limit.middleware.ts",
      path.join("scheduling", "scheduled-job.ts"),
      "schema-parser.ts",
    ]);

    const outside = sourceFiles.flatMap((file) =>
      importsOf(file)
        .filter(
          (specifier) =>
            !/^typebox(\/|$)/.test(specifier) &&
            !staysInShared(file, specifier),
        )
        .map((specifier) => `${file} -> ${specifier}`),
    );

    expect(outside).toStrictEqual([]);
  });
});
