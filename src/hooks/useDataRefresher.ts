'use client';

import { useEffect, useRef } from 'react';
import { onSnapshot, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { usePageVisibility } from './usePageVisibility';

/**
 * A custom hook that intelligently refreshes data when the app comes back into focus.
 * It checks the Firestore connection status to avoid unnecessary refreshes.
 *
 * @param onReconnect - The callback function to execute when the page becomes visible
 * after a disconnection. This is where you'll re-run your data subscriptions.
 */
export type DataRefresherOptions = {
  /** Minimum time between refreshes (prevents spam) */
  minIntervalMs?: number;
  /** If the app was backgrounded longer than this, refresh on return */
  refreshOnReturnAfterMs?: number;
};

export function useDataRefresher(onReconnect: () => void, options?: DataRefresherOptions) {
  const isVisible = usePageVisibility();

  const optsRef = useRef<DataRefresherOptions>({
    minIntervalMs: options?.minIntervalMs ?? 8_000,
    refreshOnReturnAfterMs: options?.refreshOnReturnAfterMs ?? 5_000,
  });

  const lastRefreshAtRef = useRef<number>(0);
  const lastHiddenAtRef = useRef<number | null>(null);
  const wasOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    // Keep latest option values without retriggering effects.
    optsRef.current = {
      minIntervalMs: options?.minIntervalMs ?? 8_000,
      refreshOnReturnAfterMs: options?.refreshOnReturnAfterMs ?? 5_000,
    };
  }, [options?.minIntervalMs, options?.refreshOnReturnAfterMs]);

  const tryRefresh = (reason: string) => {
    const now = Date.now();
    const { minIntervalMs } = optsRef.current;

    if (now - lastRefreshAtRef.current < (minIntervalMs ?? 0)) {
      return;
    }

    lastRefreshAtRef.current = now;
    // Useful when debugging real devices; safe to keep low-noise.
    // console.log(`[useDataRefresher] Refreshing data (${reason})`);
    onReconnect();
  };

  // Refresh when user returns to the app (visibility/focus/resume)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleReturnToApp = (reason: string) => {
      const now = Date.now();
      const lastHiddenAt = lastHiddenAtRef.current;
      const { refreshOnReturnAfterMs } = optsRef.current;

      // Only refresh on return if we were actually hidden, and for long enough.
      const shouldRefreshForDuration = lastHiddenAt && now - lastHiddenAt >= (refreshOnReturnAfterMs ?? 0);
      const shouldRefreshForOffline = wasOnlineRef.current === false;

      if (shouldRefreshForDuration || shouldRefreshForOffline) {
        tryRefresh(reason);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAtRef.current = Date.now();
      }

      if (document.visibilityState === 'visible') {
        handleReturnToApp('visibility');
      }
    };

    const onFocus = () => {
      if (document.visibilityState === 'visible') {
        handleReturnToApp('focus');
      }
    };

    const onOnline = () => {
      if (document.visibilityState === 'visible') {
        tryRefresh('online');
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
    };
  }, [onReconnect]);

  // Capacitor: refresh on native app resume/background transitions
  useEffect(() => {
    let removeListener: (() => void) | undefined;

    const attach = async () => {
      try {
        // Only attempt if we're actually in a Capacitor environment.
        if (typeof window === 'undefined') return;
        const w = window as any;
        if (!w?.Capacitor) return;

        const mod = await import('@capacitor/app');
        removeListener = (await mod.App.addListener('appStateChange', ({ isActive }) => {
          if (!isActive) {
            lastHiddenAtRef.current = Date.now();
            return;
          }

          // When returning to foreground, treat it like "return to app".
          const now = Date.now();
          const lastHiddenAt = lastHiddenAtRef.current;
          const { refreshOnReturnAfterMs } = optsRef.current;

          const shouldRefreshForDuration = lastHiddenAt && now - lastHiddenAt >= (refreshOnReturnAfterMs ?? 0);
          const shouldRefreshForOffline = wasOnlineRef.current === false;

          if (shouldRefreshForDuration || shouldRefreshForOffline) {
            tryRefresh('capacitor-resume');
          }
        })).remove;
      } catch {
        // Ignore if capacitor plugin isn't available in the current runtime.
      }
    };

    attach();

    return () => {
      removeListener?.();
    };
  }, [onReconnect]);

  // Effect to monitor Firestore connection status
  useEffect(() => {
    // This collection doesn't need to exist. We're just using the listener
    // to probe the connection status. Firestore is smart enough to handle this.
    const _check_collection = collection(db, '_connectionCheck');

    const unsubscribe = onSnapshot(
      _check_collection,
      { includeMetadataChanges: true }, // Important to get offline status
      (snapshot) => {
        // `snapshot.metadata.fromCache` is true when offline and data is served from cache.
        // When connection is restored, it becomes false.
        const currentlyOnline = !snapshot.metadata.fromCache;

        // If we detect an offline -> online transition while the app is visible,
        // force a refresh to re-run subscriptions / queries.
        if (wasOnlineRef.current !== null && wasOnlineRef.current === false && currentlyOnline && isVisible) {
          tryRefresh('firestore-reconnect');
        }

        wasOnlineRef.current = currentlyOnline;

        if (!currentlyOnline) {
          // console.log('Firestore connection is offline. Serving from cache.');
        }
      },
      (error) => {
        // console.error('Firestore connection check error:', error);

        if (isVisible) {
          console.log('Firestore connection error while tab is visible. Refreshing data...');
          tryRefresh('firestore-error');
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isVisible, onReconnect]);
}