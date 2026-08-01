import React from "react";

/**
 * Wraps React.lazy with auto-reload on chunk load failure.
 * After a new deploy, returning users may have an HTML pointing to chunk
 * hashes that no longer exist on the CDN. Instead of showing the error
 * boundary, force a single hard reload to pick up the fresh index.html.
 */
const RELOAD_KEY = "__diziline_chunk_reloaded__";

export function lazyWithRetry<T extends { default: React.ComponentType<any> }>(
  factory: () => Promise<T>
): React.LazyExoticComponent<T["default"]> {
  return React.lazy(async () => {
    try {
      const mod = await factory();
      // success — clear the flag so future failures can reload again
      try { window.sessionStorage.removeItem(RELOAD_KEY); } catch {}
      return mod;
    } catch (err: any) {
      const msg = String(err?.message || err || "");
      const isChunkError =
        /Failed to fetch dynamically imported module/i.test(msg) ||
        /Importing a module script failed/i.test(msg) ||
        /ChunkLoadError/i.test(msg) ||
        /Loading chunk [\d]+ failed/i.test(msg) ||
        /error loading dynamically imported module/i.test(msg);

      if (isChunkError) {
        let alreadyReloaded = false;
        try { alreadyReloaded = window.sessionStorage.getItem(RELOAD_KEY) === "1"; } catch {}
        if (!alreadyReloaded) {
          try { window.sessionStorage.setItem(RELOAD_KEY, "1"); } catch {}
          // Force a fresh fetch of index.html
          window.location.reload();
          // Return a never-resolving promise so React keeps showing Suspense
          // fallback until the reload happens.
          return new Promise(() => {}) as unknown as T;
        }
      }
      throw err;
    }
  });
}
