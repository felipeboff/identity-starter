import { useCallback, useEffect, useRef, useState } from "preact/hooks";

export type Resource<T> = {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => Promise<void>;
};

export const useResource = <T>(
  load: () => Promise<T>,
  deps: readonly unknown[],
): Resource<T> => {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const call = ++latest.current;
    setLoading(true);
    try {
      const result = await load();
      if (call !== latest.current) return;
      setData(result);
      setError(null);
    } catch (failure) {
      if (call === latest.current) setError(failure);
    } finally {
      if (call === latest.current) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
};
