'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMobileNavigation } from '@/contexts/mobile-navigation-context';
import { useAuth } from '@/hooks/use-auth';
import { getHomePathForRole } from '@/lib/navigation';

export type AppNavigationApi = {
  push: (href: string) => void;
  replace: (href: string) => void;
  /**
   * Navigate back in history. `delta` behaves like `history.go(-delta)`;
   * default is 1 (one step back).
   */
  back: (delta?: number) => void;
};

const AppNavigationContext = createContext<AppNavigationApi | null>(null);

function parseMobileHashTarget(href: string):
  | { kind: 'page'; value: string }
  | { kind: 'tab'; value: string }
  | null {
  // Accept both "#/..." and "/path#..." forms.
  const idx = href.indexOf('#');
  const hash = idx >= 0 ? href.slice(idx) : href;

  if (hash.startsWith('#page=')) {
    const raw = hash.slice('#page='.length);
    return { kind: 'page', value: raw };
  }
  if (hash.startsWith('#tab=')) {
    const raw = hash.slice('#tab='.length);
    return { kind: 'tab', value: raw };
  }
  return null;
}

function decodeHashValue(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function setHash(hash: string, mode: 'push' | 'replace') {
  if (typeof window === 'undefined') return;
  if (!hash.startsWith('#')) return;
  if (window.location.hash === hash) return;

  const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;
  if (mode === 'replace') window.history.replaceState(null, '', nextUrl);
  else window.history.pushState(null, '', nextUrl);

  // Ensure listeners update immediately (some environments don't fire hashchange for pushState).
  try {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } catch {
    window.dispatchEvent(new Event('hashchange'));
  }
}

export function AppNavigationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const mobileNav = useMobileNavigation();
  const { user } = useAuth();

  const api = useMemo<AppNavigationApi>(() => {
    const push = (href: string) => {
      if (isMobile && mobileNav) {
        const parsed = parseMobileHashTarget(href);
        if (parsed?.kind === 'page') {
          mobileNav.push(decodeHashValue(parsed.value));
          return;
        }
        if (parsed?.kind === 'tab') {
          setHash(`#tab=${encodeURIComponent(decodeHashValue(parsed.value))}`, 'push');
          return;
        }

        // Default mobile behavior: treat input as a "page" href.
        mobileNav.push(href);
        return;
      }

      // Desktop behavior: keep normal routing semantics.
      router.push(href);
    };

    const replace = (href: string) => {
      if (isMobile && mobileNav) {
        const parsed = parseMobileHashTarget(href);
        if (parsed?.kind === 'page') {
          mobileNav.replace(decodeHashValue(parsed.value));
          return;
        }
        if (parsed?.kind === 'tab') {
          setHash(`#tab=${encodeURIComponent(decodeHashValue(parsed.value))}`, 'replace');
          return;
        }

        mobileNav.replace(href);
        return;
      }
      router.replace(href);
    };

    const back = () => {
      // If we're on a mobile device, always go to the Home *tab* so the shell
      // shows the dashboard/tab UI instead of performing a history pop.
      if (isMobile) {
        setHash('#tab=home', 'push');
        return;
      } else {
        router.back();
        return;
      }
    };

    return { push, replace, back }; 
  }, [isMobile, mobileNav, router, user]);

  return <AppNavigationContext.Provider value={api}>{children}</AppNavigationContext.Provider>;
}

export function useAppNavigation() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const mobileNav = useMobileNavigation();
  const ctx = useContext(AppNavigationContext);
  if (ctx) return ctx;

  // Fallback: allow usage even when provider isn't mounted.
  // This keeps the hook safe for isolated components/tests.
  return {
    push: (href: string) => {
      // If we're on mobile but outside the provider tree (e.g. header-mounted components
      // like NotificationSheet), we still want SPA hash navigation instead of router.
      if (isMobile && !mobileNav) {
        const parsed = parseMobileHashTarget(href);
        if (parsed?.kind === 'page') {
          setHash(`#page=${encodeURIComponent(decodeHashValue(parsed.value))}`, 'push');
          return;
        }
        if (parsed?.kind === 'tab') {
          setHash(`#tab=${encodeURIComponent(decodeHashValue(parsed.value))}`, 'push');
          return;
        }

        setHash(`#page=${encodeURIComponent(href)}`, 'push');
        return;
      }

      router.push(href);
    },
    replace: (href: string) => {
      if (isMobile && !mobileNav) {
        const parsed = parseMobileHashTarget(href);
        if (parsed?.kind === 'page') {
          setHash(`#page=${encodeURIComponent(decodeHashValue(parsed.value))}`, 'replace');
          return;
        }
        if (parsed?.kind === 'tab') {
          setHash(`#tab=${encodeURIComponent(decodeHashValue(parsed.value))}`, 'replace');
          return;
        }

        setHash(`#page=${encodeURIComponent(href)}`, 'replace');
        return;
      }

      router.replace(href);
    },
    back: () => {
      // Mobile (outside provider or not): switch to the Home tab so the shell
      // presents the dashboard UI predictably.
      if (isMobile && !mobileNav) {
        setHash('#tab=home', 'push');
        return;
      }

      router.back();
    },
  } satisfies AppNavigationApi;
}
