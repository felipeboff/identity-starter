import type { Entry } from "../handler";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HttpFailureStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429;

export type HttpRoute<TActor = undefined> = Entry<TActor> &
  Readonly<{
    method: HttpMethod;
    path: string;
    status: 200 | 201 | 202 | 204;
    failures: readonly HttpFailureStatus[];
  }>;
