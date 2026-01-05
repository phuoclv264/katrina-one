'use client';

import { useEffect, useRef } from 'react';
import { onSnapshot, collection, doc, getDoc } from 'firebase/firestore';
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
    refreshOnReturnAfterMs: options?.refreshOnReturnAfterMs ?? 5_000,
    refreshOnBrowserOnline: options?.refreshOnBrowserOnline ?? true,
  });

  const lastRefreshAtRef = useRef<number>(0);
  const lastHiddenAtRef = useRef<number | null>(null);
  // Count consecutive offline snapshots to avoid flapping.
  const offlineStreakRef = useRef<number>(0);
  const wasOnlineRef = useRef<boolean | null>(null);
  // Rate limit server probes so we don't spam network while retrying
  const lastProbeAtRef = useRef<number>(0);
  const OFFLINE_STREAK_THRESHOLD = 3;
  const MIN_PROBE_INTERVAL_MS = 10_000; // 10s


  useEffect(() => {
    // Keep latest option values without retriggering effects.
    optsRef.current = {
      minIntervalMs: options?.minIntervalMs ?? 8_000,
      refreshOnReturnAfterMs: options?.refreshOnReturnAfterMs ?? 5_000,
      refreshOnBrowserOnline: options?.refreshOnBrowserOnline ?? true,
    };
  }, [options?.minIntervalMs, options?.refreshOnReturnAfterMs, options?.refreshOnBrowserOnline]);

  const tryRefresh = (reason: string) => {
    const now = Date.now();
    const { minIntervalMs } = optsRef.current;

    const sinceLast = now - lastRefreshAtRef.current;
    const min = minIntervalMs ?? 0;

    if (sinceLast < min) {
      console.log(
        `[useDataRefresher] Skipping refresh (throttled). reason=${reason} sinceLast=${sinceLast}ms minIntervalMs=${min} isVisible=${isVisible} wasOnline=${wasOnlineRef.current}`
      );
      return;
    }

    lastRefreshAtRef.current = now;
    console.log(`[useDataRefresher] Refreshing data (${reason})`);
    onReconnect();
  };

  // When the app becomes visible again, refresh only if we previously detected
  // a connectivity problem (offline or error). Do NOT use `fromCache` as the
  // signal because Firestore often emits cache-first snapshots while online.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        lastHiddenAtRef.current = Date.now();
        return;
      }

      // document.visibilityState === 'visible'
      // Only refresh when we previously detected a connectivity issue.
      if (wasOnlineRef.current === false) {
        tryRefresh('visibility-after-connectivity-issue');
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [onReconnect]);

  // Browser network signal: when coming online while visible, refresh.
  // This is more reliable for "connection lost" than Firestore `fromCache`.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const onOnline = () => {
      if (!optsRef.current.refreshOnBrowserOnline) return;
      if (document.visibilityState !== 'visible') return;

      // Mark that we have connectivity again.
      wasOnlineRef.current = true;
      tryRefresh('browser-online');
    };

    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
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
        // Use metadata pattern to detect degraded connectivity when the onSnapshot
        // error callback doesn't fire (common for transient network drops).
        try {
          const fromCache = !!snapshot?.metadata?.fromCache;
          if (fromCache) {
            offlineStreakRef.current = (offlineStreakRef.current || 0) + 1;
            // If we see several consecutive cached snapshots, treat this as a likely
            // connectivity degradation and attempt a refresh (rate-limited).
            if (offlineStreakRef.current >= OFFLINE_STREAK_THRESHOLD) {
              if (wasOnlineRef.current !== false) {
                console.warn('[useDataRefresher] Detected repeated cache-only snapshots -> possible offline');
                wasOnlineRef.current = false;
                tryRefresh('fromCache-streak');
              }

              const now = Date.now();
              if (now - lastProbeAtRef.current > MIN_PROBE_INTERVAL_MS) {
                lastProbeAtRef.current = now;
                // Probe the server to confirm reachability. If probe fails, trigger a refresh.
                (async () => {
                  try {
                    // Small doc used only to test server reachability; create it if you like.
                    const probeDocRef = doc(db, 'app-data', 'connectionProbe');
                    await getDoc(probeDocRef);
                    // Probe succeeded; reset offline indicators.
                    offlineStreakRef.current = 0;
                    wasOnlineRef.current = true;
                    console.log('[useDataRefresher] Server probe succeeded after cached snapshot streak');
                  } catch (probeErr) {
                    console.warn('[useDataRefresher] Server probe failed after cached snapshot streak', probeErr);
                    if (document.visibilityState === 'visible') tryRefresh('server-probe-failed');
                  }
                })();
              }
            }
          } else {
            // healthy snapshot from server
            offlineStreakRef.current = 0;
            wasOnlineRef.current = true;
          }
        } catch (e) {
          // Safely ignore unanticipated metadata shapes
          console.debug('[useDataRefresher] Failed to interpret snapshot metadata', e);
        }
      },
      (error) => {
        console.error('Firestore connection check error:', error);

        console.log('[useDataRefresher] Detected Firestore connectivity issue (error callback), isVisible=', isVisible);

        // Mark that we had a connectivity issue; when we come back online/visible,
        // we will refresh subscriptions.
        wasOnlineRef.current = false;

        // Also attempt a server probe to confirm the error indicates an unreachable server
        (async () => {
          try {
            const probeDocRef = doc(db, 'app-data', 'connectionProbe');
            await getDoc(probeDocRef);
            // If probe succeeded, we likely had a transient issue - mark online.
            wasOnlineRef.current = true;
            console.log('[useDataRefresher] Server probe succeeded despite onSnapshot error');
            // still trigger a refresh to be safe
            if (isVisible) tryRefresh('firestore-error-probe-succeeded');
          } catch (probeErr) {
            console.warn('[useDataRefresher] Server probe failed after onSnapshot error', probeErr);
            if (isVisible) tryRefresh('firestore-error');
          }
        })();
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isVisible, onReconnect]);
}