import type { TokenStore } from "../auth/token-store";

import { ApiError, type ProblemDetails } from "./api-error";
import type { SessionTokens } from "./identity.types";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiRequest = {
  method: HttpMethod;
  path: string;
  body?: unknown;
  authenticated?: boolean;
};

export type ApiResponse = {
  status: number;
  ok: boolean;
  body: unknown;
  durationMs: number;
};

export type ApiClientDeps = {
  baseUrl: string;
  tokens: TokenStore;
};

const REFRESH_LOCK = "identity-starter.refresh";
const NETWORK_FAILURE_STATUS = 0;

export class ApiClient {
  private refreshing: Promise<boolean> | null = null;

  constructor(private readonly deps: ApiClientDeps) {}

  async send<T>(request: ApiRequest): Promise<T> {
    let response = await this.exchange(request);
    if (response.status === 401 && request.authenticated) {
      if (await this.refresh()) response = await this.exchange(request);
    }
    if (!response.ok) throw new ApiError(this.toProblem(response));
    return response.body as T;
  }

  async exchange(request: ApiRequest): Promise<ApiResponse> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (request.body !== undefined)
      headers["content-type"] = "application/json";
    const tokens = this.deps.tokens.read();
    if (request.authenticated && tokens) {
      headers.authorization = `Bearer ${tokens.accessToken}`;
    }

    const startedAt = performance.now();
    try {
      const response = await fetch(this.deps.baseUrl + request.path, {
        method: request.method,
        headers,
        body:
          request.body === undefined ? undefined : JSON.stringify(request.body),
      });
      const text = await response.text();
      return {
        status: response.status,
        ok: response.ok,
        body: this.parse(text),
        durationMs: Math.round(performance.now() - startedAt),
      };
    } catch {
      return {
        status: NETWORK_FAILURE_STATUS,
        ok: false,
        body: null,
        durationMs: Math.round(performance.now() - startedAt),
      };
    }
  }

  private refresh(): Promise<boolean> {
    this.refreshing ??= this.rotate().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async rotate(): Promise<boolean> {
    const stale = this.deps.tokens.read();
    if (!stale) return false;

    return this.exclusively(async () => {
      const current = this.deps.tokens.read();
      if (!current) return false;
      if (current.refreshToken !== stale.refreshToken) return true;

      const response = await this.exchange({
        method: "POST",
        path: "/auth/refresh",
        body: { refreshToken: current.refreshToken },
      });
      if (response.ok) {
        this.deps.tokens.save(response.body as SessionTokens);
        return true;
      }
      if (this.endsSession(response.status)) this.deps.tokens.clear();
      return false;
    });
  }

  private exclusively<T>(work: () => Promise<T>): Promise<T> {
    if (!("locks" in navigator)) return work();
    return navigator.locks.request(REFRESH_LOCK, work);
  }

  private endsSession(status: number): boolean {
    return status >= 400 && status < 500 && status !== 429;
  }

  private parse(text: string): unknown {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private toProblem(response: ApiResponse): ProblemDetails {
    const body = response.body;
    if (typeof body === "object" && body !== null && "code" in body) {
      return body as ProblemDetails;
    }
    return {
      type: "about:blank",
      title: "Unexpected response",
      status: response.status,
      code:
        response.status === NETWORK_FAILURE_STATUS
          ? "client.network_failed"
          : "client.unexpected_response",
    };
  }
}
