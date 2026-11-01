import { useEffect, useState } from "preact/hooks";

export type AppLocation = {
  pathname: string;
  search: URLSearchParams;
};

type HistoryListener = () => void;

export class AppHistory {
  private readonly listeners = new Set<HistoryListener>();

  constructor() {
    window.addEventListener("popstate", () => this.emit());
  }

  get location(): AppLocation {
    return {
      pathname: window.location.pathname,
      search: new URLSearchParams(window.location.search),
    };
  }

  push(path: string): void {
    if (path === window.location.pathname + window.location.search) return;
    window.history.pushState(null, "", path);
    window.scrollTo({ top: 0 });
    this.emit();
  }

  replace(path: string): void {
    window.history.replaceState(null, "", path);
    this.emit();
  }

  internalPath(candidate: string | null): string {
    if (
      !candidate ||
      !candidate.startsWith("/") ||
      candidate.startsWith("//")
    ) {
      return "/";
    }
    return candidate;
  }

  subscribe(listener: HistoryListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export const appHistory = new AppHistory();

export const useLocation = (): AppLocation => {
  const [, setVersion] = useState(0);
  useEffect(
    () => appHistory.subscribe(() => setVersion((version) => version + 1)),
    [],
  );
  return appHistory.location;
};
