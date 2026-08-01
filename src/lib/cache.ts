/**
 * Simple sessionStorage cache with TTL support.
 * Used to avoid re-fetching config/static data on every component mount.
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export function getCached<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(`cache:${key}`);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      sessionStorage.removeItem(`cache:${key}`);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + ttlMs,
    };
    sessionStorage.setItem(`cache:${key}`, JSON.stringify(entry));
  } catch {
    // sessionStorage full or unavailable — ignore
  }
}

export function clearCache(key: string): void {
  try {
    sessionStorage.removeItem(`cache:${key}`);
  } catch {
    // ignore
  }
}
