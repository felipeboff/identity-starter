export type TransactionRunner = {
  run<T>(work: () => Promise<T>): Promise<T>;
  afterCommit(callback: () => void): void;
  isRunning(): boolean;
};
