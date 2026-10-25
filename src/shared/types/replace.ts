export type Replace<T, R, Removed extends keyof T = never> = Omit<
  T,
  keyof R | Removed
> &
  R;
