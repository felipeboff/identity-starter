export type PasswordHasher = {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string | null): Promise<boolean>;
};
