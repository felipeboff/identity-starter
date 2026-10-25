export type AccessTokenClaims = {
  accountId: string;
  sessionId: string;
};

export type AccessToken = {
  issue(claims: AccessTokenClaims): Promise<string>;
  verify(token: string): Promise<AccessTokenClaims | null>;
};
