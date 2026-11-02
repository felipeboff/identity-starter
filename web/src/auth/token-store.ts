import type { SessionTokens } from "../api/identity.types";

const STORAGE_KEY = `${import.meta.env.VITE_APP_NAME}.session`;

export type TokenChangeOrigin = "this-tab" | "other-tab";

export type TokenListener = (
  tokens: SessionTokens | null,
  origin: TokenChangeOrigin,
) => void;

export class TokenStore {
  private readonly listeners = new Set<TokenListener>();

  constructor(private readonly storage: Storage) {
    window.addEventListener("storage", (event) => {
      if (event.key === STORAGE_KEY) this.emit("other-tab");
    });
  }

  read(): SessionTokens | null {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed: Partial<SessionTokens> = JSON.parse(raw);
      if (!parsed.accessToken || !parsed.refreshToken) return null;
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
      };
    } catch {
      return null;
    }
  }

  save(tokens: SessionTokens): void {
    this.storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }),
    );
    this.emit("this-tab");
  }

  clear(): void {
    this.storage.removeItem(STORAGE_KEY);
    this.emit("this-tab");
  }

  subscribe(listener: TokenListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(origin: TokenChangeOrigin): void {
    const tokens = this.read();
    for (const listener of this.listeners) listener(tokens, origin);
  }
}
