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
  /** In addition to Firestore reconnection, refresh when the browser reports network online */
  refreshOnBrowserOnline?: boolean;
};

export function useDataRefresher(onReconnect: () => void, options?: DataRefresherOptions) {
  const isVisible = usePageVisibility();

  const optsRef = useRef<DataRefresherOptions>({
    minIntervalMs: options?.minIntervalMs ?? 8_000,
    // Default to 1 hour to avoid refreshing on short background periods.
    refreshOnReturnAfterMs: options?.refreshOnReturnAfterMs ?? 3_600_000,
    refreshOnBrowserOnline: options?.refreshOnBrowserOnline ?? true,
  });

  const lastRefreshAtRef = useRef<number>(0);
  const lastHiddenAtRef = useRef<number | null>(null);
  // Whether we've received the initial snapshot for the Firestore check listener.
  const subscribedRef = useRef<boolean>(false);
  const wasOnlineRef = useRef<boolean | null>(null);
  // Prevent overlapping refresh calls when multiple events fire at once.
  const inFlightRefreshRef = useRef<boolean>(false);


  useEffect(() => {
    // Keep latest option values without retriggering effects.
    optsRef.current = {
      minIntervalMs: options?.minIntervalMs ?? 8_000,
      // Default to 1 hour to avoid refreshing on short background periods.
      refreshOnReturnAfterMs: options?.refreshOnReturnAfterMs ?? 3_600_000,
      refreshOnBrowserOnline: options?.refreshOnBrowserOnline ?? true,
    };
  }, [options?.minIntervalMs, options?.refreshOnReturnAfterMs, options?.refreshOnBrowserOnline]);

  const tryRefresh = (reason: string) => {
    const now = Date.now();
    const { minIntervalMs } = optsRef.current;

    const sinceLast = now - lastRefreshAtRef.current;
    const min = minIntervalMs ?? 0;

    if (inFlightRefreshRef.current) {
      console.log(
        `[useDataRefresher] Skipping refresh (in-flight). reason=${reason} isVisible=${isVisible} wasOnline=${wasOnlineRef.current}`
      );
      return;
    }

    if (sinceLast < min) {
      console.log(
        `[useDataRefresher] Skipping refresh (throttled). reason=${reason} sinceLast=${sinceLast}ms minIntervalMs=${min} isVisible=${isVisible} wasOnline=${wasOnlineRef.current}`
      );
      return;
    }

    lastRefreshAtRef.current = now;
    inFlightRefreshRef.current = true;
    console.log(`[useDataRefresher] Refreshing data (${reason})`);

    // Support async callbacks safely; clear in-flight flag when finished.
    Promise.resolve()
      .then(() => onReconnect())
      .finally(() => {
        inFlightRefreshRef.current = false;
      });
  };

  // When the app becomes visible again, refresh only if we previously detected
  // a connectivity problem (offline or error). Do NOT use `fromCache` as the
  // signal because Firestore often emits cache-first snapshots while online.
  // useEffect(() => {
  //   if (typeof window === 'undefined' || typeof document === 'undefined') return;

  //   const onVisibilityChange = () => {
  //     if (document.visibilityState === 'hidden') {
  //       lastHiddenAtRef.current = Date.now();
  //       return;
  //     }

  //     // document.visibilityState === 'visible'
  //     // Refresh when we previously detected a connectivity issue OR when the
  //     // page was backgrounded longer than `refreshOnReturnAfterMs`.
  //     const now = Date.now();
  //     const refreshOnReturnAfterMs = optsRef.current.refreshOnReturnAfterMs ?? 0;
  //     const wasLongHidden = lastHiddenAtRef.current != null && (now - lastHiddenAtRef.current >= refreshOnReturnAfterMs);

  //     if (wasOnlineRef.current === false) {
  //       tryRefresh('visibility-after-connectivity-issue');
  //     } else if (wasLongHidden) {
  //       tryRefresh('visibility-after-long-background');
  //     }

  //     // Clear the hidden timestamp once handled.
  //     lastHiddenAtRef.current = null;
  //   };

  //   document.addEventListener('visibilitychange', onVisibilityChange);

  //   return () => {
  //     document.removeEventListener('visibilitychange', onVisibilityChange);
  //   };
  // }, [onReconnect]);

  // Effect to monitor Firestore connection status
  useEffect(() => {
    // This collection doesn't need to exist. We're just using the listener
    // to probe the connection status. Firestore is smart enough to handle this.
    const _check_collection = collection(db, '_connectionCheck');

    const unsubscribe = onSnapshot(
      _check_collection,
      { includeMetadataChanges: true }, // Important to get offline status
      (snapshot) => {
        // Snapshot callback: the initial snapshot indicates a successful connection
        // — trigger a refresh on the first subscribe so the caller can re-run subscriptions.
        if (!subscribedRef.current) {
          subscribedRef.current = true;
          wasOnlineRef.current = true; // mark online
          tryRefresh('firestore-initial-subscribe');
        }
      },
      (error) => {
        console.error('Firestore connection check error:', error);
        console.log('[useDataRefresher] Detected Firestore connectivity issue (error callback), isVisible=', isVisible);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isVisible, onReconnect]);
}