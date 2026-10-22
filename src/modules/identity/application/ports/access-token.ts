export type AccessTokenClaims = {
  accountId: string;
  sessionId: string;
};

export type AccessToken = {
  issue(claims: AccessTokenClaims): string;
  verify(token: string): AccessTokenClaims | null;
};
