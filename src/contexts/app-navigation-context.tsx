"use client";

import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/use-auth';
import usePreserveScroll from '@/hooks/use-preserve-scroll';
import {
  resetMobileHistory,
  createHistoryEntry,
  recordPushEntry,
  recordReplaceEntry,
  recordBackEntry,
  applyHistoryEntry,
  normalizeBackDelta,
  initMobileHistory,
} from '@/lib/mobile-history';

// Utility used by the navigation helpers.  Given a full href, remove one or
// more query parameters from either the normal search string or, when the
// link is encoded in a mobile hash (#page=...), the inner search string.
function stripParamsFromHref(href: string, params: string[]): string {
  try {
    const url = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    params.forEach(p => url.searchParams.delete(p));

    // handle mobile-style hash as well
    if (url.hash.startsWith('#page=')) {
      const inner = decodeURIComponent(url.hash.slice('#page='.length));
      const innerUrl = new URL(inner, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      params.forEach(p => innerUrl.searchParams.delete(p));
      url.hash = `#page=${encodeURIComponent(innerUrl.pathname + innerUrl.search + innerUrl.hash)}`;
    }

    // reconstruct relative portion
    return url.pathname + url.search + url.hash;
  } catch {
    // fallback naive removal
    let result = href;
    params.forEach(p => {
      // remove from query
      const regex = new RegExp(`[?&]${p}=[^&]*`);
      result = result.replace(regex, '');
    });
    // collapse stray ? or &
    result = result.replace(/\?&/, '?').replace(/&\?$/, '');
    return result;
  }
}

export type AppNavigationApi = {
  push: (
    href: string,
    options?: { scroll?: boolean; clearHashOnly?: boolean; clearParam?: string | string[] },
  ) => void;
  /**
   * Replace the current entry in history.
   *
   * The `options` object supports several flags:
   *   * `scroll` – forwarded to Next.js router on desktop (same as before).
   *   * `clearHashOnly` – strip the hash/search segment entirely (legacy
   *     behaviour still used in a few places).
   *   * `clearParam` – remove the named query parameter(s) from the URL;
   *     when the value lives inside a mobile hash we update only that portion
   *     and leave the hash itself untouched.  This is the preferred solution
   *     when you want to drop a single param without affecting other state.
   */
  replace: (
    href: string,
    options?: { scroll?: boolean; clearHashOnly?: boolean; clearParam?: string | string[] },
  ) => void;
  /**
   * Navigate back in history. `delta` behaves like `history.go(-delta)`;
   * default is 1 (one step back).
   */
  back: (delta?: number) => void;
};

const AppNavigationContext = createContext<AppNavigationApi | null>(null);

// Mobile history helpers are provided by `src/lib/mobile-history.ts`

// Move buildAppNavigationApi to module scope so it can be reused by the
// provider and the fallback in `useAppNavigation`.
const buildAppNavigationApi = (
  router: any,
  isMobile: boolean,
  persistScroll?: (() => void) | null,
): AppNavigationApi => {
  const safePersistScroll = () => {
    try {
      persistScroll?.();
    } catch {}
  };

  const push = (
    href: string,
    options?: { scroll?: boolean; clearHashOnly?: boolean; clearParam?: string | string[] },
  ) => {
    // Handle clearing specific query parameters first.  This may operate on
    // either the normal search string or the encoded search inside a mobile
    // hash.  We do not alter any other portion of the URL.
    if (options?.clearParam) {
      const params = Array.isArray(options.clearParam) ? options.clearParam : [options.clearParam];
      if (typeof window !== 'undefined') {
        const current = window.location.href;
        const updated = stripParamsFromHref(current, params);
        window.history.replaceState(null, '', updated);
      }
      if (isMobile) {
        const entry = createHistoryEntry(href || window.location.pathname);
        recordReplaceEntry(entry);
      }
      return;
    }

    // `clearHashOnly` is a legacy helper used in a couple of places when we
    // simply wanted to drop all query/hash information. It remains supported
    // for now.
    if (options?.clearHashOnly) {
      if (typeof window !== 'undefined') {
        const url = `${window.location.pathname}${window.location.search}`;
        window.history.replaceState(null, '', url);
      }
      if (isMobile) {
        const entry = createHistoryEntry(href || (typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : ''));
        recordReplaceEntry(entry);
      }
      return;
    }

    if (isMobile) {
      safePersistScroll();
      const entry = createHistoryEntry(href);
      recordPushEntry(entry);
      applyHistoryEntry(entry, 'push');
      return;
    }

    // Desktop behavior: keep normal routing semantics.
    // Forward options if supplied so callers can control scrolling, etc.
    if (options) {
      router.push(href, options);
    } else {
      router.push(href);
    }
  };

  const replace = (
    href: string,
    options?: { scroll?: boolean; clearHashOnly?: boolean; clearParam?: string | string[] },
  ) => {
    if (options?.clearParam) {
      const params = Array.isArray(options.clearParam) ? options.clearParam : [options.clearParam];
      if (typeof window !== 'undefined') {
        const current = window.location.href;
        const updated = stripParamsFromHref(current, params);
        window.history.replaceState(null, '', updated);
      }
      if (isMobile) {
        const entry = createHistoryEntry(href || window.location.pathname);
        recordReplaceEntry(entry);
      }
      return;
    }

    if (options?.clearHashOnly) {
      if (typeof window !== 'undefined') {
        const url = `${window.location.pathname}${window.location.search}`;
        window.history.replaceState(null, '', url);
      }
      if (isMobile) {
        const entry = createHistoryEntry(href || (typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : ''));
        recordReplaceEntry(entry);
      }
      return;
    }

    if (isMobile) {
      safePersistScroll();
      const entry = createHistoryEntry(href);
      recordReplaceEntry(entry);
      applyHistoryEntry(entry, 'replace');
      return;
    }
    if (options) {
      router.replace(href, options);
    } else {
      router.replace(href);
    }
  };

  const back = (delta?: number) => {
    if (isMobile) {
      safePersistScroll();
      const steps = normalizeBackDelta(delta);
      const entry = recordBackEntry(steps);
      applyHistoryEntry(entry, 'replace');
      return;
    }

    router.back();
    return;
  };

  return { push, replace, back };
};

export function AppNavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { persist: persistScroll } = usePreserveScroll();

  useEffect(() => () => {
    resetMobileHistory();
  }, []);

  useEffect(() => {
    if (!isMobile) {
      resetMobileHistory();
      return;
    }

    initMobileHistory();
  }, [isMobile, user?.uid, user?.role]);

  // Use the module-level buildAppNavigationApi (defined above) so the same
  // implementation is available to the provider and the fallback hook.

  const api = useMemo(() => buildAppNavigationApi(router, isMobile, persistScroll), [isMobile, persistScroll, router]);

  return <AppNavigationContext.Provider value={api}>{children}</AppNavigationContext.Provider>;
}

export function useAppNavigation() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const ctx = useContext(AppNavigationContext);
  if (ctx) return ctx;

  // Fallback: allow usage even when provider isn't mounted.
  // Reuse the same implementation as the provider to avoid duplication.
  return buildAppNavigationApi(router, isMobile, null);
}
