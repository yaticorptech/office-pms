import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Runs a fetcher and tracks { data, meta, loading, error }, aborting the previous
 * request whenever the inputs change so out-of-order responses can't overwrite
 * fresher data (important while typing in a search box).
 *
 * `fetcher` must be memoised by the caller — it is the dependency that triggers refetch.
 */
export const useApiResource = (fetcher, { enabled = true, initialData = null } = {}) => {
  const [data, setData] = useState(initialData);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const controllerRef = useRef(null);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const response = await fetcher({ signal: controller.signal });
      if (controller.signal.aborted) return;
      setData(response?.data ?? null);
      setMeta(response?.meta ?? null);
    } catch (caught) {
      if (caught.name === 'AbortError' || controller.signal.aborted) return;
      setError(caught);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    load();
    return () => controllerRef.current?.abort();
  }, [enabled, load]);

  return { data, meta, loading, error, refetch: load, setData };
};
