// Resolve backend-served asset paths (/uploads/...) into absolute URLs
// the browser can actually fetch when the frontend is deployed
// separately from the backend (dev: Vite 5173 + API 3000).
//
// Uses the same `VITE_API_BASE_URL` the api service reads — strips the
// trailing `/api` so `/uploads/...` lands on the backend origin root.
// Absolute URLs and data URIs pass through unchanged.

const trimTrailingSlash = (s: string): string => s.replace(/\/+$/, '');

/**
 * Memoized computation of the uploads origin — derived from
 * `VITE_API_BASE_URL` once, not on every call.
 */
const uploadsOrigin = (() => {
  const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

  let base: string | null = null;
  if (configuredBaseUrl) {
    try {
      const parsed = new URL(configuredBaseUrl, window.location.origin);
      base = trimTrailingSlash(parsed.toString());
    } catch {
      base = null;
    }
  }

  if (!base) {
    // Fall back to same-origin; matches `ApiService.getOptimalApiUrl`
    // production behaviour.
    base = trimTrailingSlash(window.location.origin);
  }

  // `base` typically ends in `/api`. `/uploads/...` lives at the parent
  // origin, so strip the trailing `/api` segment if present.
  if (base.endsWith('/api')) {
    base = base.slice(0, -'/api'.length);
  }
  return base;
})();

/**
 * Resolve a server-relative asset path (e.g. `/uploads/profile-photos/...`)
 * into an absolute URL suitable for `<img src>`.
 *
 * - Absolute `http(s)://` URLs and `data:` URIs are returned unchanged.
 * - `null` / `undefined` / empty returns `undefined` (so
 *   `<AvatarImage src={resolveAssetUrl(user?.profilePhotoUrl)}>` falls
 *   back to the avatar's `<AvatarFallback>` cleanly).
 */
export function resolveAssetUrl(url: string | null | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  if (/^(https?:|data:)/i.test(url)) {
    return url;
  }
  if (url.startsWith('/')) {
    return `${uploadsOrigin}${url}`;
  }
  return url;
}
