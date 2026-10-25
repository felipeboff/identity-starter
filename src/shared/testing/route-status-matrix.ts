import type { HttpRoute } from "../presentation/http/http-route";

type DeclaredRoute = Pick<
  HttpRoute<unknown>,
  "method" | "path" | "status" | "failures"
>;
type ObservedRoute = Pick<HttpRoute<unknown>, "method" | "path">;

const DECLARED = "declared";
const OBSERVED = "observed";

export class RouteStatusMatrix {
  private readonly declared = new Set<string>();
  private readonly observed = new Set<string>();

  static declarationLines(routes: readonly DeclaredRoute[]): string {
    return routes
      .flatMap((route) =>
        [route.status, ...route.failures].map(
          (status) => `${DECLARED} ${route.method} ${route.path} ${status}\n`,
        ),
      )
      .join("");
  }

  static observationLine(route: ObservedRoute, status: number): string {
    return status >= 500
      ? ""
      : `${OBSERVED} ${route.method} ${route.path} ${status}\n`;
  }

  static parse(text: string): RouteStatusMatrix {
    const matrix = new RouteStatusMatrix();
    for (const line of text.split("\n").filter(Boolean)) {
      const [kind, ...pair] = line.split(" ");
      (kind === DECLARED ? matrix.declared : matrix.observed).add(
        pair.join(" "),
      );
    }
    return matrix;
  }

  missing(): string[] {
    return [...this.declared].filter((pair) => !this.observed.has(pair)).sort();
  }

  undeclared(): string[] {
    return [...this.observed].filter((pair) => !this.declared.has(pair)).sort();
  }
}
