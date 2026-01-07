/**
 * Utilities for reading URL params in both desktop (search params) and
 * mobile-hash navigation mode.
 *
 * Mobile hash example:
 *   #page=%2Fmonthly-task-reports%3Fmonth%3D2025-12%26highlight%3D...
 * Decode the hash value, then parse its query string.
 */

export const MOBILE_PAGE_HASH_PREFIX = "#page="

export function decodeHashValue(raw: string): string {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function getMobilePageHrefFromHash(hash: string): string | null {
  if (!hash) return null

  // Accept callers passing full URL that contains a hash.
  const idx = hash.indexOf("#")
  const onlyHash = idx >= 0 ? hash.slice(idx) : hash

  if (!onlyHash.startsWith(MOBILE_PAGE_HASH_PREFIX)) return null
  const raw = onlyHash.slice(MOBILE_PAGE_HASH_PREFIX.length)
  return decodeHashValue(raw)
}

export function getSearchParamsFromHref(href: string): URLSearchParams {
  // Accept '/path?x=1', 'https://host/path?x=1', '?x=1', etc.
  try {
    const url = new URL(href, "http://localhost")
    return new URLSearchParams(url.search)
  } catch {
    const qIndex = href.indexOf("?")
    if (qIndex < 0) return new URLSearchParams()
    return new URLSearchParams(href.slice(qIndex))
  }
}

/**
 * Reads a query param with a mobile-hash fallback.
 *
 * Priority:
 *  1) regular search params (Next.js useSearchParams)
 *  2) window.location.hash encoded "#page=...?..."
 */
export function getQueryParamWithMobileHashFallback(opts: {
  param: string
  searchParams?: URLSearchParams | ReadonlyURLSearchParams | null
  hash?: string
}): string | null {
  const direct = opts.searchParams?.get(opts.param)
  if (direct) return direct

  const hrefFromHash = getMobilePageHrefFromHash(opts.hash ?? "")
  if (!hrefFromHash) return null

  return getSearchParamsFromHref(hrefFromHash).get(opts.param)
}

// Compatibility type so callers can pass Next.js ReadonlyURLSearchParams
// without importing Next.js types into lib.
export type ReadonlyURLSearchParams = {
  get: (name: string) => string | null
}
