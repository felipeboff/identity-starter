import { ALL_OAUTH_PROVIDERS, type OAuthProvider } from "../api/identity.types";

export type OAuthIntent = "sign-in" | "link";

export type OAuthCallback = {
  provider: string;
  code: string | null;
  state: string | null;
  error: string | null;
};

export type OAuthGrant = {
  provider: OAuthProvider;
  intent: OAuthIntent;
  code: string;
  codeVerifier: string;
};

type OAuthAttempt = {
  provider: OAuthProvider;
  intent: OAuthIntent;
  state: string;
  codeVerifier: string;
};

type ProviderSettings = {
  clientId: string;
  authorizeUrl: string;
  scope: string;
  envName: string;
  extraParams: Record<string, string>;
};

const STORAGE_KEY = `${import.meta.env.VITE_APP_NAME}.oauth`;

const PROVIDERS: Record<OAuthProvider, ProviderSettings> = {
  github: {
    clientId: import.meta.env.VITE_GITHUB_CLIENT_ID ?? "",
    authorizeUrl: "https://github.com/login/oauth/authorize",
    scope: "read:user user:email",
    envName: "VITE_GITHUB_CLIENT_ID",
    extraParams: {},
  },
  google: {
    clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope: "openid email profile",
    envName: "VITE_GOOGLE_CLIENT_ID",
    extraParams: { response_type: "code" },
  },
};

export class OAuthFlowError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export class OAuthFlow {
  constructor(private readonly storage: Storage) {}

  isConfigured(provider: OAuthProvider): boolean {
    return PROVIDERS[provider].clientId !== "";
  }

  missingConfigName(provider: OAuthProvider): string {
    return PROVIDERS[provider].envName;
  }

  redirectUri(provider: OAuthProvider): string {
    return `${window.location.origin}/auth/${provider}/callback`;
  }

  async start(provider: OAuthProvider, intent: OAuthIntent): Promise<void> {
    const settings = PROVIDERS[provider];
    const attempt: OAuthAttempt = {
      provider,
      intent,
      state: this.randomToken(16),
      codeVerifier: this.randomToken(32),
    };
    this.storage.setItem(STORAGE_KEY, JSON.stringify(attempt));

    const url = new URL(settings.authorizeUrl);
    const params: Record<string, string> = {
      client_id: settings.clientId,
      redirect_uri: this.redirectUri(provider),
      scope: settings.scope,
      state: attempt.state,
      code_challenge: await this.challengeOf(attempt.codeVerifier),
      code_challenge_method: "S256",
      ...settings.extraParams,
    };
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    window.location.assign(url);
  }

  complete(callback: OAuthCallback): OAuthGrant {
    const attempt = this.takeAttempt();
    if (callback.error) {
      throw new OAuthFlowError("client.oauth_cancelled");
    }
    if (!attempt || !callback.state || callback.state !== attempt.state) {
      throw new OAuthFlowError("client.oauth_unrecognized");
    }
    if (attempt.provider !== callback.provider || !callback.code) {
      throw new OAuthFlowError("client.oauth_incomplete");
    }
    return {
      provider: attempt.provider,
      intent: attempt.intent,
      code: callback.code,
      codeVerifier: attempt.codeVerifier,
    };
  }

  isProvider(value: string): value is OAuthProvider {
    return (ALL_OAUTH_PROVIDERS as readonly string[]).includes(value);
  }

  private takeAttempt(): OAuthAttempt | null {
    const raw = this.storage.getItem(STORAGE_KEY);
    this.storage.removeItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OAuthAttempt;
    } catch {
      return null;
    }
  }

  private randomToken(byteLength: number): string {
    return this.base64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
  }

  private async challengeOf(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(verifier),
    );
    return this.base64Url(new Uint8Array(digest));
  }

  private base64Url(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
}
