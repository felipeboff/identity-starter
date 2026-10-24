import type { Entry } from "../handler";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HttpRoute<TActor = undefined> = Entry<TActor> &
  Readonly<{
    method: HttpMethod;
    path: string;
    status: 200 | 201 | 202 | 204;
  }>;
