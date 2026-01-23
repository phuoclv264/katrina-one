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

  const push = (href: string) => {
    if (isMobile) {
      safePersistScroll();
      const entry = createHistoryEntry(href);
      recordPushEntry(entry);
      applyHistoryEntry(entry, 'push');
      return;
    }

    // Desktop behavior: keep normal routing semantics.
    router.push(href);
  };

  const replace = (href: string) => {
    if (isMobile) {
      safePersistScroll();
      const entry = createHistoryEntry(href);
      recordReplaceEntry(entry);
      applyHistoryEntry(entry, 'replace');
      return;
    }
    router.replace(href);
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
