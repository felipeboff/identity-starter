export type TokenIssuer = {
  issue(): { token: string; tokenHash: string };
  hash(token: string): string;
};
