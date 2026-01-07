import { useEffect, useCallback, useMemo } from 'react';

// Hook that persists and restores scroll position per-location using sessionStorage.
// Returns { restore, persist } so callers can save before virtual navigation.
export default function usePreserveScroll() {
  const keyFor = (href?: string) => {
    try {
      if (href) return 'scroll:' + href;
      return 'scroll:' + `${location.pathname}${location.search}${location.hash}`;
    } catch {
      return 'scroll:';
    }
  };

  const restore = useCallback((href?: string) => {
    if (typeof window === 'undefined') return;
    try {
      const key = keyFor(href);
      const raw = sessionStorage.getItem(key);
      const target = raw != null ? (parseInt(raw, 10) || 0) : 0;

      // Try several times because content may not be fully rendered yet
      const maxAttempts = 8;
      const attempt = (n: number) => {
        try {
          requestAnimationFrame(() => {
            window.scrollTo(0, target);
            const diff = Math.abs((window.scrollY || 0) - target);
            if (diff > 4 && n < maxAttempts) {
              setTimeout(() => attempt(n + 1), 50 * (n + 1));
            }
          });
        } catch {}
      };

      attempt(0);
    } catch {}
  }, []);

  const persist = useCallback((href?: string) => {
    if (typeof window === 'undefined') return;
    try {
      const key = keyFor(href);
      const y = Math.max(0, Math.floor(window.scrollY || 0));
      sessionStorage.setItem(key, String(y));
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      history.scrollRestoration = 'manual';
    } catch {}

    let raf = 0;

    const onScroll = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // noop; we read window.scrollY when persisting
      });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') persist();
    };

    const onPageHide = () => persist();
    const onPop = () => restore();
    const onHash = () => restore();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('popstate', onPop);
    window.addEventListener('hashchange', onHash);

    // restore on mount
    restore();

    return () => {
      persist();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onHash);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // return stable references
  return useMemo(() => ({ restore, persist }), [restore, persist]);
}
