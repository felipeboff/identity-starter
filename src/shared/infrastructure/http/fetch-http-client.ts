export type HttpHeaders = Readonly<Record<string, string>>;

export type HttpForm = Readonly<Record<string, string>>;

export type HttpRequestBody =
  Readonly<{ json: unknown }> | Readonly<{ form: HttpForm }>;

export type HttpRequest = Readonly<{
  method: "GET" | "POST";
  url: string;
  headers?: HttpHeaders;
  body?: HttpRequestBody;
}>;

export type HttpFailure = "timeout" | "network";

export type HttpResult =
  | Readonly<{ ok: true; status: number; body: unknown }>
  | Readonly<{ ok: false; failure: HttpFailure }>;

export type FetchHttpClientOptions = Readonly<{
  timeoutMs: number;
  fetch?: typeof fetch;
}>;

export class FetchHttpClient {
  private readonly fetch: typeof fetch;

  constructor(private readonly options: FetchHttpClientOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async send(request: HttpRequest): Promise<HttpResult> {
    try {
      const response = await this.fetch(request.url, {
        method: request.method,
        headers: { ...this.contentType(request.body), ...request.headers },
        body: this.encode(request.body),
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
      const body = this.decode(await response.text());
      return { ok: true, status: response.status, body };
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      return { ok: false, failure: timedOut ? "timeout" : "network" };
    }
  }

  private contentType(
    body: HttpRequestBody | undefined,
  ): Record<string, string> {
    if (!body) return {};
    return {
      "content-type":
        "json" in body
          ? "application/json"
          : "application/x-www-form-urlencoded",
    };
  }

  private encode(body: HttpRequestBody | undefined) {
    if (!body) return undefined;
    return "json" in body
      ? JSON.stringify(body.json)
      : new URLSearchParams(body.form).toString();
  }

  private decode(text: string): unknown {
    if (text === "") return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}
