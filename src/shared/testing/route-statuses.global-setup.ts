import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import type { TestProject } from "vitest/node";

import { RouteStatusMatrix } from "./route-status-matrix";

declare module "vitest" {
  export interface ProvidedContext {
    routeStatusFile: string;
  }
}

export default function setup(project: TestProject) {
  const directory = mkdtempSync(path.join(tmpdir(), "route-statuses-"));
  const file = path.join(directory, "statuses.log");
  project.provide("routeStatusFile", file);

  return () => {
    const text = existsSync(file) ? readFileSync(file, "utf8") : "";
    rmSync(directory, { recursive: true, force: true });
    if (process.env.ROUTE_STATUSES !== "strict") return;

    const matrix = RouteStatusMatrix.parse(text);
    const gaps = [
      ...matrix.missing().map((pair) => `missing e2e test: ${pair}`),
      ...matrix.undeclared().map((pair) => `undeclared status: ${pair}`),
    ];
    if (gaps.length > 0) {
      throw new Error(`Route statuses out of sync:\n${gaps.join("\n")}`);
    }
  };
}
