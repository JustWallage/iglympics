import { useState, useEffect, useCallback, useRef } from "react";

// In-memory cache shared across all hook instances
const cache = new Map<string, unknown>();

interface UseCachedFetchOptions {
  /** Skip fetching (e.g. when a dependency isn't ready yet) */
  enabled?: boolean;
}

/**
 * SWR-like hook: returns cached data instantly, revalidates in background.
 * - `data` is populated from cache immediately (no loading flash on revisit)
 * - `loading` is true only on first-ever fetch (no cached data)
 * - Call `mutate()` to trigger a background revalidation (e.g. from WebSocket)
 */
export function useCachedFetch<T>(
  url: string | null,
  opts?: UseCachedFetchOptions,
) {
  const enabled = opts?.enabled !== false;
  const cacheKey = url ?? "";
  const cached = url ? (cache.get(cacheKey) as T | undefined) : undefined;

  const [data, setData] = useState<T | undefined>(cached);
  const [loading, setLoading] = useState(!cached);
  const urlRef = useRef(url);
  urlRef.current = url;

  const fetchData = useCallback(async () => {
    const currentUrl = urlRef.current;
    if (!currentUrl) return;
    try {
      const res = await fetch(currentUrl);
      if (res.ok) {
        const json = (await res.json()) as T;
        cache.set(currentUrl, json);
        // Only update state if this is still the current URL
        if (urlRef.current === currentUrl) {
          setData(json);
        }
      }
    } finally {
      if (urlRef.current === currentUrl) {
        setLoading(false);
      }
    }
  }, []);

  // Fetch on mount / URL change
  useEffect(() => {
    if (!url || !enabled) return;
    const cached = cache.get(url) as T | undefined;
    if (cached) {
      setData(cached);
      setLoading(false);
    }
    fetchData();
  }, [url, enabled, fetchData]);

  return { data, loading, mutate: fetchData };
}
