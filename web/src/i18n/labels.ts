import type { OAuthProvider } from "../api/identity.types";

export const PROVIDER_LABELS: Record<OAuthProvider, string> = {
  github: "GitHub",
  google: "Google",
};
