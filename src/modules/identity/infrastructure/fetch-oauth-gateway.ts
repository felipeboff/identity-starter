import { Logger } from "@shared/application/ports/logger";
import { AppError } from "@shared/domain/errors/app-error";
import {
  FetchHttpClient,
  HttpForm,
  HttpHeaders,
  HttpRequest,
} from "@shared/infrastructure/http/fetch-http-client";
import Type, { type StaticDecode, type TSchema } from "typebox";
import Value from "typebox/value";

import {
  OAuthCodeExchange,
  OAuthGateway,
  OAuthProfile,
} from "../application/ports/oauth-gateway";

import { ExternalCallFailure, IdentityLogEvent } from "./identity.log-event";

import { AuthProvider } from "@/identity/domain/credential.entity";
import { IdentityError } from "@/identity/domain/errors/identity.error";
import { OAuthProviderName } from "@/identity/domain/value-objects/oauth-provider.value-object";

export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_USERINFO_URL =
  "https://openidconnect.googleapis.com/v1/userinfo";
export const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
export const GITHUB_USER_URL = "https://api.github.com/user";
export const GITHUB_EMAILS_URL = "https://api.github.com/user/emails";

const OK = 200;
const BAD_REQUEST = 400;

export type OAuthClientConfig = Readonly<{
  clientId: string;
  clientSecret: string;
  redirectUri: URL;
}>;

export type FetchOAuthGatewayDeps = Readonly<{
  http: FetchHttpClient;
  logger: Logger;
  google: OAuthClientConfig;
  github: OAuthClientConfig;
}>;

type OAuthStep = "token" | "profile" | "emails";

type ProviderResponse = Readonly<{ status: number; body: unknown }>;

type CodeExchange = (exchange: OAuthCodeExchange) => Promise<OAuthProfile>;

const trimmedTextSchema = Type.Codec(Type.String())
  .Decode((value) => value.trim())
  .Encode(String);

const tokenSchema = Type.Object({
  access_token: Type.String({ minLength: 1 }),
});

const providerErrorSchema = Type.Object({
  error: Type.String({ minLength: 1 }),
});

const googleUserSchema = Type.Object({
  sub: Type.String({ minLength: 1 }),
  email: Type.String({ format: "email" }),
  email_verified: Type.Boolean(),
  name: Type.Optional(trimmedTextSchema),
});

const githubUserSchema = Type.Object({
  id: Type.Integer({ minimum: 1 }),
  login: Type.String({ minLength: 1 }),
  name: Type.Union([trimmedTextSchema, Type.Null()]),
  email: Type.Union([Type.String({ format: "email" }), Type.Null()]),
});

const githubEmailsSchema = Type.Array(
  Type.Object({
    email: Type.String({ format: "email" }),
    primary: Type.Boolean(),
    verified: Type.Boolean(),
  }),
);

export class FetchOAuthGateway implements OAuthGateway {
  private readonly exchanges: Record<OAuthProviderName, CodeExchange> = {
    [AuthProvider.GOOGLE]: (exchange) => this.google(exchange),
    [AuthProvider.GITHUB]: (exchange) => this.github(exchange),
    [AuthProvider.APPLE]: () =>
      Promise.reject(
        new AppError(IdentityError.OAuthProviderNotSupported, {
          provider: AuthProvider.APPLE,
        }),
      ),
  };

  constructor(private readonly deps: FetchOAuthGatewayDeps) {}

  exchangeCode(exchange: OAuthCodeExchange): Promise<OAuthProfile> {
    return this.exchanges[exchange.provider](exchange);
  }

  private async google(exchange: OAuthCodeExchange): Promise<OAuthProfile> {
    const provider = AuthProvider.GOOGLE;
    const { clientId, clientSecret, redirectUri } = this.deps.google;

    const token = await this.send(provider, "token", {
      method: "POST",
      url: GOOGLE_TOKEN_URL,
      headers: { accept: "application/json" },
      body: {
        form: {
          grant_type: "authorization_code",
          code: exchange.code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri.href,
          ...this.verifierOf(exchange),
        },
      },
    });
    if (
      token.status === BAD_REQUEST &&
      this.providerError(token.body) === "invalid_grant"
    ) {
      throw new AppError(IdentityError.OAuthCodeRejected, { provider });
    }
    const { access_token } = this.read(provider, "token", token, tokenSchema);

    const user = this.read(
      provider,
      "profile",
      await this.send(provider, "profile", {
        method: "GET",
        url: GOOGLE_USERINFO_URL,
        headers: { authorization: `Bearer ${access_token}` },
      }),
      googleUserSchema,
    );
    if (!user.email_verified) {
      throw new AppError(IdentityError.OAuthEmailNotVerified, { provider });
    }

    return {
      subject: user.sub,
      email: user.email,
      name: user.name || user.email,
    };
  }

  private async github(exchange: OAuthCodeExchange): Promise<OAuthProfile> {
    const provider = AuthProvider.GITHUB;
    const { clientId, clientSecret, redirectUri } = this.deps.github;

    const token = await this.send(provider, "token", {
      method: "POST",
      url: GITHUB_TOKEN_URL,
      headers: { accept: "application/json" },
      body: {
        form: {
          client_id: clientId,
          client_secret: clientSecret,
          code: exchange.code,
          redirect_uri: redirectUri.href,
          ...this.verifierOf(exchange),
        },
      },
    });
    if (
      token.status === OK &&
      this.providerError(token.body) === "bad_verification_code"
    ) {
      throw new AppError(IdentityError.OAuthCodeRejected, { provider });
    }
    const { access_token } = this.read(provider, "token", token, tokenSchema);

    const headers = {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${access_token}`,
      "user-agent": "identity-starter",
      "x-github-api-version": "2022-11-28",
    };
    const user = this.read(
      provider,
      "profile",
      await this.send(provider, "profile", {
        method: "GET",
        url: GITHUB_USER_URL,
        headers,
      }),
      githubUserSchema,
    );

    return {
      subject: String(user.id),
      email: user.email ?? (await this.githubPrimaryEmail(headers)),
      name: user.name || user.login,
    };
  }

  private async githubPrimaryEmail(headers: HttpHeaders): Promise<string> {
    const provider = AuthProvider.GITHUB;
    const emails = this.read(
      provider,
      "emails",
      await this.send(provider, "emails", {
        method: "GET",
        url: GITHUB_EMAILS_URL,
        headers,
      }),
      githubEmailsSchema,
    );

    const primary = emails.find((email) => email.primary && email.verified);
    if (!primary) {
      throw new AppError(IdentityError.OAuthEmailNotVerified, { provider });
    }
    return primary.email;
  }

  private async send(
    provider: OAuthProviderName,
    step: OAuthStep,
    request: HttpRequest,
  ): Promise<ProviderResponse> {
    const result = await this.deps.http.send(request);
    if (!result.ok) return this.fail(provider, step, result.failure);
    return result;
  }

  private read<S extends TSchema>(
    provider: OAuthProviderName,
    step: OAuthStep,
    response: ProviderResponse,
    schema: S,
  ): StaticDecode<S> {
    if (response.status !== OK) {
      return this.fail(provider, step, "unexpected_status", response);
    }
    if (!Value.Check(schema, response.body)) {
      return this.fail(provider, step, "unexpected_body", response);
    }
    return Value.Decode(schema, response.body);
  }

  private verifierOf(exchange: OAuthCodeExchange): HttpForm {
    return exchange.codeVerifier === undefined
      ? {}
      : { code_verifier: exchange.codeVerifier };
  }

  private providerError(body: unknown): string | undefined {
    return Value.Check(providerErrorSchema, body) ? body.error : undefined;
  }

  private fail(
    provider: OAuthProviderName,
    step: OAuthStep,
    failure: ExternalCallFailure,
    response?: ProviderResponse,
  ): never {
    this.deps.logger.error(IdentityLogEvent.OAuthProviderFailed, {
      provider,
      step,
      failure,
      ...(response && {
        status: response.status,
        providerError: this.providerError(response.body),
      }),
    });
    throw new AppError(IdentityError.OAuthProviderFailed, { provider });
  }
}
