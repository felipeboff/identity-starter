import { SharedLogEvent } from "@shared/application/logging/shared.log-event";
import { Logger } from "@shared/application/ports/logger";
import ky, { type BeforeRetryState, type KyInstance, isHTTPError } from "ky";

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
  logger: Logger;
  fetch?: typeof fetch;
}>;

const RETRY_STATUSES = [408, 500, 502, 503, 504];

export class FetchHttpClient {
  private readonly client: KyInstance;

  constructor(private readonly options: FetchHttpClientOptions) {
    this.client = ky.create({
      fetch: options.fetch ?? globalThis.fetch,
      timeout: false,
      throwHttpErrors: (status) => RETRY_STATUSES.includes(status),
      retry: {
        limit: 2,
        methods: ["get"],
        statusCodes: RETRY_STATUSES,
        afterStatusCodes: [],
        jitter: true,
      },
      hooks: { beforeRetry: [(state) => this.logRetry(state)] },
    });
  }

  async send(request: HttpRequest): Promise<HttpResult> {
    try {
      const response = await this.client(request.url, {
        method: request.method,
        headers: { ...this.contentType(request.body), ...request.headers },
        body: this.encode(request.body),
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });
      const body = this.decode(await response.text());
      return { ok: true, status: response.status, body };
    } catch (error) {
      if (isHTTPError(error)) {
        return {
          ok: true,
          status: error.response.status,
          body: error.data ?? null,
        };
      }
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      return { ok: false, failure: timedOut ? "timeout" : "network" };
    }
  }

  private logRetry(state: BeforeRetryState): void {
    const url = new URL(state.request.url);
    this.options.logger.warn(SharedLogEvent.ExternalCallRetried, {
      method: state.request.method,
      url: `${url.origin}${url.pathname}`,
      attempt: state.retryCount,
      ...(isHTTPError(state.error)
        ? { failure: "status", status: state.error.response.status }
        : { failure: "network" }),
    });
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
