import type { HttpMethod } from "../api/api-client";
import {
  ALL_OAUTH_PROVIDERS,
  type Me,
  type Permission,
} from "../api/identity.types";

export type TemplateContext = {
  me: Me | null;
  refreshToken: string | null;
  sample: string;
};

export type RouteId =
  | "sign-up"
  | "sign-in"
  | "oauth-sign-in"
  | "refresh"
  | "password-reset-request"
  | "password-reset"
  | "email-verification"
  | "accept-invitation"
  | "confirm-email-change"
  | "sign-out"
  | "get-me"
  | "update-name"
  | "change-password"
  | "request-email-change"
  | "request-email-verification"
  | "list-credentials"
  | "link-oauth"
  | "unlink-oauth"
  | "list-sessions"
  | "revoke-other-sessions"
  | "revoke-session"
  | "list-account-sessions"
  | "revoke-all-sessions"
  | "deactivate-account"
  | "reactivate-account"
  | "list-members"
  | "update-member-role"
  | "update-member-permissions"
  | "invite-member"
  | "list-invitations"
  | "revoke-invitation";

export type RouteGroup =
  "auth" | "account" | "sessions" | "members" | "invitations";

export type QueryName = "limit" | "cursor";

export type RateLimitWindow = "hour" | "quarter-hour";

export type RateLimitScope = "ip" | "email";

export type RateLimit = {
  max: number;
  window: RateLimitWindow;
  scope: RateLimitScope;
};

export type CatalogRoute = {
  id: RouteId;
  group: RouteGroup;
  method: HttpMethod;
  path: string;
  authenticated: boolean;
  permission?: Permission;
  status: number;
  failures: readonly number[];
  rateLimits?: readonly RateLimit[];
  body?: (context: TemplateContext) => unknown;
  query?: readonly QueryName[];
};

export const PROVIDER_OPTIONS = ALL_OAUTH_PROVIDERS;

const SAMPLE_PASSWORD = "a long and safe passphrase";

export const ROUTE_CATALOG: readonly CatalogRoute[] = [
  {
    id: "sign-up",
    group: "auth",
    method: "POST",
    path: "/auth/sign-up",
    authenticated: false,
    status: 201,
    failures: [400, 429],
    rateLimits: [{ max: 10, window: "hour", scope: "ip" }],
    body: (context) => ({
      name: "Ada Lovelace",
      email: `ada.${context.sample}@example.com`,
      password: SAMPLE_PASSWORD,
    }),
  },
  {
    id: "sign-in",
    group: "auth",
    method: "POST",
    path: "/auth/sign-in",
    authenticated: false,
    status: 200,
    failures: [400, 401, 404, 409, 422, 429],
    rateLimits: [{ max: 20, window: "quarter-hour", scope: "ip" }],
    body: (context) => ({
      email: context.me?.account.email ?? "ada@example.com",
      password: SAMPLE_PASSWORD,
    }),
  },
  {
    id: "oauth-sign-in",
    group: "auth",
    method: "POST",
    path: "/auth/oauth/:provider",
    authenticated: false,
    status: 200,
    failures: [400, 401, 403, 404, 422, 429],
    rateLimits: [{ max: 20, window: "quarter-hour", scope: "ip" }],
    body: () => ({ code: "", codeVerifier: "" }),
  },
  {
    id: "refresh",
    group: "auth",
    method: "POST",
    path: "/auth/refresh",
    authenticated: false,
    status: 200,
    failures: [400, 401, 404, 422, 429],
    rateLimits: [{ max: 60, window: "quarter-hour", scope: "ip" }],
    body: (context) => ({ refreshToken: context.refreshToken ?? "" }),
  },
  {
    id: "password-reset-request",
    group: "auth",
    method: "POST",
    path: "/auth/password-reset/request",
    authenticated: false,
    status: 204,
    failures: [400, 422, 429],
    rateLimits: [
      { max: 5, window: "hour", scope: "ip" },
      { max: 3, window: "hour", scope: "email" },
    ],
    body: (context) => ({
      email: context.me?.account.email ?? "ada@example.com",
    }),
  },
  {
    id: "password-reset",
    group: "auth",
    method: "POST",
    path: "/auth/password-reset",
    authenticated: false,
    status: 204,
    failures: [400, 401, 404, 422, 429],
    rateLimits: [{ max: 10, window: "hour", scope: "ip" }],
    body: () => ({ token: "", newPassword: SAMPLE_PASSWORD }),
  },
  {
    id: "email-verification",
    group: "auth",
    method: "POST",
    path: "/auth/email-verification",
    authenticated: false,
    status: 200,
    failures: [400, 401, 404, 422, 429],
    rateLimits: [{ max: 10, window: "hour", scope: "ip" }],
    body: () => ({ token: "" }),
  },
  {
    id: "accept-invitation",
    group: "auth",
    method: "POST",
    path: "/auth/invitations/accept",
    authenticated: false,
    status: 201,
    failures: [400, 401, 422, 429],
    rateLimits: [{ max: 10, window: "hour", scope: "ip" }],
    body: () => ({
      token: "",
      name: "Grace Hopper",
      password: SAMPLE_PASSWORD,
    }),
  },
  {
    id: "confirm-email-change",
    group: "auth",
    method: "POST",
    path: "/auth/email-change",
    authenticated: false,
    status: 200,
    failures: [400, 401, 422, 429],
    rateLimits: [{ max: 10, window: "hour", scope: "ip" }],
    body: () => ({ token: "" }),
  },
  {
    id: "sign-out",
    group: "account",
    method: "POST",
    path: "/auth/sign-out",
    authenticated: true,
    status: 204,
    failures: [401],
  },
  {
    id: "get-me",
    group: "account",
    method: "GET",
    path: "/me",
    authenticated: true,
    status: 200,
    failures: [401],
  },
  {
    id: "update-name",
    group: "account",
    method: "PATCH",
    path: "/me",
    authenticated: true,
    status: 200,
    failures: [400, 401],
    body: (context) => ({ name: context.me?.account.name ?? "Ada Lovelace" }),
  },
  {
    id: "change-password",
    group: "account",
    method: "PUT",
    path: "/me/password",
    authenticated: true,
    status: 204,
    failures: [400, 401, 404, 422, 429],
    rateLimits: [{ max: 10, window: "hour", scope: "ip" }],
    body: () => ({
      oldPassword: SAMPLE_PASSWORD,
      newPassword: `${SAMPLE_PASSWORD} renewed`,
    }),
  },
  {
    id: "request-email-change",
    group: "account",
    method: "POST",
    path: "/me/email",
    authenticated: true,
    status: 204,
    failures: [400, 401, 422, 429],
    rateLimits: [{ max: 5, window: "hour", scope: "ip" }],
    body: (context) => ({
      newEmail: `new.${context.sample}@example.com`,
      password: SAMPLE_PASSWORD,
    }),
  },
  {
    id: "request-email-verification",
    group: "account",
    method: "POST",
    path: "/me/email-verification",
    authenticated: true,
    status: 204,
    failures: [401, 409, 422, 429],
    rateLimits: [{ max: 5, window: "hour", scope: "ip" }],
  },
  {
    id: "list-credentials",
    group: "account",
    method: "GET",
    path: "/me/credentials",
    authenticated: true,
    status: 200,
    failures: [401],
  },
  {
    id: "link-oauth",
    group: "account",
    method: "POST",
    path: "/me/oauth/:provider",
    authenticated: true,
    status: 201,
    failures: [400, 401, 403, 409, 422, 429],
    rateLimits: [{ max: 20, window: "quarter-hour", scope: "ip" }],
    body: () => ({ code: "", codeVerifier: "" }),
  },
  {
    id: "unlink-oauth",
    group: "account",
    method: "DELETE",
    path: "/me/oauth/:provider",
    authenticated: true,
    status: 204,
    failures: [400, 401, 404, 422],
  },
  {
    id: "list-sessions",
    group: "sessions",
    method: "GET",
    path: "/me/sessions",
    authenticated: true,
    status: 200,
    failures: [401],
  },
  {
    id: "revoke-other-sessions",
    group: "sessions",
    method: "DELETE",
    path: "/me/sessions",
    authenticated: true,
    status: 200,
    failures: [401],
  },
  {
    id: "revoke-session",
    group: "sessions",
    method: "DELETE",
    path: "/sessions/:sessionId",
    authenticated: true,
    permission: "session.revoke",
    status: 204,
    failures: [400, 401, 403, 404],
  },
  {
    id: "list-account-sessions",
    group: "sessions",
    method: "GET",
    path: "/accounts/:accountId/sessions",
    authenticated: true,
    permission: "session.read",
    status: 200,
    failures: [400, 401, 403],
  },
  {
    id: "revoke-all-sessions",
    group: "sessions",
    method: "DELETE",
    path: "/accounts/:accountId/sessions",
    authenticated: true,
    permission: "session.revoke_all",
    status: 200,
    failures: [400, 401, 403],
  },
  {
    id: "deactivate-account",
    group: "members",
    method: "POST",
    path: "/accounts/:accountId/deactivate",
    authenticated: true,
    permission: "account.deactivate",
    status: 204,
    failures: [400, 401, 403, 404],
  },
  {
    id: "reactivate-account",
    group: "members",
    method: "POST",
    path: "/accounts/:accountId/reactivate",
    authenticated: true,
    permission: "account.reactivate",
    status: 200,
    failures: [400, 401, 403, 404],
  },
  {
    id: "list-members",
    group: "members",
    method: "GET",
    path: "/members",
    authenticated: true,
    permission: "member.read",
    status: 200,
    failures: [400, 401, 403],
    query: ["limit", "cursor"],
  },
  {
    id: "update-member-role",
    group: "members",
    method: "PUT",
    path: "/members/:accountId/role",
    authenticated: true,
    permission: "member.role.update",
    status: 200,
    failures: [400, 401, 403, 404, 422],
    body: () => ({ role: "admin" }),
  },
  {
    id: "update-member-permissions",
    group: "members",
    method: "PUT",
    path: "/members/:accountId/permissions",
    authenticated: true,
    permission: "member.permissions.update",
    status: 200,
    failures: [400, 401, 403, 404, 422],
    body: (context) => ({
      permissions: context.me?.membership.permissions ?? [],
    }),
  },
  {
    id: "invite-member",
    group: "invitations",
    method: "POST",
    path: "/invitations",
    authenticated: true,
    permission: "invitation.create",
    status: 201,
    failures: [400, 401, 403, 422],
    body: (context) => ({
      email: `guest.${context.sample}@example.com`,
      role: "user",
      permissions: [],
    }),
  },
  {
    id: "list-invitations",
    group: "invitations",
    method: "GET",
    path: "/invitations",
    authenticated: true,
    permission: "invitation.read",
    status: 200,
    failures: [401, 403],
  },
  {
    id: "revoke-invitation",
    group: "invitations",
    method: "DELETE",
    path: "/invitations/:invitationId",
    authenticated: true,
    permission: "invitation.revoke",
    status: 204,
    failures: [400, 401, 403, 404, 422],
  },
];

export class RoutePath {
  paramsOf(path: string): string[] {
    return path
      .split("/")
      .filter((segment) => segment.startsWith(":"))
      .map((segment) => segment.slice(1));
  }

  withQuery(path: string, values: Record<string, string>): string {
    const query = new URLSearchParams(
      Object.entries(values).filter(([, value]) => value !== ""),
    );
    return query.size > 0 ? `${path}?${query}` : path;
  }

  fill(path: string, values: Record<string, string>): string {
    return path.replace(/:([A-Za-z]+)/g, (_, name: string) =>
      encodeURIComponent(values[name] ?? ""),
    );
  }
}
