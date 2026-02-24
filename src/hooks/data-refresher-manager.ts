'use client';

import { onSnapshot, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type DataRefresherOptions = {
  minIntervalMs?: number;
  refreshOnReturnAfterMs?: number;
  refreshOnBrowserOnline?: boolean;
};

type Subscriber = {
  id: number;
  callback: () => void;
  options?: DataRefresherOptions;
};

let nextId = 1;
const subscribers = new Map<number, Subscriber>();

// Manager state
let unsubscribeSnapshot: (() => void) | null = null;
let isStarted = false;
let wasOnline: boolean | null = null;
let lastRefreshAt = 0;
let inFlight = false;

const DEFAULTS: Required<DataRefresherOptions> = {
  minIntervalMs: 8_000,
  // 1 hour in milliseconds
  refreshOnReturnAfterMs: 3_600_000,
  refreshOnBrowserOnline: true,
};

let lastHiddenAt: number | null = null;

function getEffectiveMinInterval() {
  // Use the minimum minIntervalMs among subscribers, or default
  if (subscribers.size === 0) return DEFAULTS.minIntervalMs;
  let min = Number.POSITIVE_INFINITY;
  subscribers.forEach(s => {
    const v = s.options?.minIntervalMs ?? DEFAULTS.minIntervalMs;
    if (v < min) min = v;
  });
  return min === Number.POSITIVE_INFINITY ? DEFAULTS.minIntervalMs : min;
}

function anyWantsBrowserOnlineRefresh() {
  for (const s of subscribers.values()) {
    if (s.options?.refreshOnBrowserOnline ?? DEFAULTS.refreshOnBrowserOnline) return true;
  }
  return false;
}

function getEffectiveReturnAfterMs() {
  if (subscribers.size === 0) return DEFAULTS.refreshOnReturnAfterMs;
  let min = Number.POSITIVE_INFINITY;
  subscribers.forEach(s => {
    const v = s.options?.refreshOnReturnAfterMs ?? DEFAULTS.refreshOnReturnAfterMs;
    if (v < min) min = v;
  });
  return min === Number.POSITIVE_INFINITY ? DEFAULTS.refreshOnReturnAfterMs : min;
}

async function tryRefresh(reason: string): Promise<boolean> {
  const now = Date.now();
  const min = getEffectiveMinInterval();
  const sinceLast = now - lastRefreshAt;

  console.log(`[dataRefresher] check: reason=${reason} min=${min} sinceLast=${sinceLast} lastRefreshAt=${lastRefreshAt} inFlight=${inFlight} wasOnline=${wasOnline}`);

  if (inFlight) {
    console.log(`[dataRefresher] Skipping refresh (in-flight). reason=${reason} wasOnline=${wasOnline}`);
    return false;
  }

  if (sinceLast < min) {
    console.log(`[dataRefresher] Skipping refresh (throttled). reason=${reason} sinceLast=${sinceLast}ms minIntervalMs=${min} wasOnline=${wasOnline}`);
    return false;
  }

  lastRefreshAt = now;
  inFlight = true;
  console.log(`[dataRefresher] Refreshing data (${reason}) — lastRefreshAt=${lastRefreshAt} inFlight=${inFlight}`);

  try {
    const callbacks = Array.from(subscribers.values()).map(s => s.callback);
    await Promise.allSettled(callbacks.map(cb => Promise.resolve().then(() => cb())));
    return true;
  } finally {
    inFlight = false;
    console.log(`[dataRefresher] Refresh complete (${reason}) — lastRefreshAt=${lastRefreshAt} inFlight=${inFlight}`);
  }
}

function startIfNeeded() {
  if (isStarted) return;
  isStarted = true;

  // Firestore connectivity probe
  const _check = collection(db, '_connectionCheck');
  unsubscribeSnapshot = onSnapshot(
    _check,
    { includeMetadataChanges: true },
    () => {
      if (wasOnline !== true) {
        wasOnline = true;
        console.log('[dataRefresher] firestore-initial-subscribe: online');
        void tryRefresh('firestore-initial-subscribe');
      }
    },
    (error) => {
      console.error('Firestore connection check error:', error);
      wasOnline = false;
      console.log('[dataRefresher] Detected Firestore connectivity issue (error callback)');
    }
  );

  // Browser online/offline listeners
  const onOnline = () => {
    const wasOffline = wasOnline === false;
    wasOnline = true;
    console.log(`[dataRefresher] browser-online wasOffline=${wasOffline}`);
    if (anyWantsBrowserOnlineRefresh() && wasOffline) {
      void tryRefresh('browser-online');
    }
  };

  const onOffline = () => {
    wasOnline = false;
    console.log('[dataRefresher] browser-offline');
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
  }

  // Visibility change handling: refresh when returning after a long background
  // period (based on subscribers' `refreshOnReturnAfterMs`) or after a known
  // connectivity issue.
  const onVisibilityChange = () => {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'hidden') {
      lastHiddenAt = Date.now();
      return;
    }

    // document.visibilityState === 'visible'
    const now = Date.now();
    const minReturnMs = getEffectiveReturnAfterMs();
    const wasLongHidden = lastHiddenAt != null && (now - lastHiddenAt >= minReturnMs);

    if (wasOnline === false) {
      console.log('[dataRefresher] visibility-after-connectivity-issue');
      void tryRefresh('visibility-after-connectivity-issue');
    } else if (wasLongHidden) {
      console.log('[dataRefresher] visibility-after-long-background');
      void tryRefresh('visibility-after-long-background');
    }

    lastHiddenAt = null;
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  // store cleanup function to stop listeners when there are no subscribers
  const stop = () => {
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    unsubscribeSnapshot = null;
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    isStarted = false;
    wasOnline = null;
    lastHiddenAt = null;
  };

  // attach stop function for later use
  (startIfNeeded as any)._stop = stop;
}

function stopIfIdle() {
  if (subscribers.size === 0 && isStarted) {
    const stop = (startIfNeeded as any)._stop as () => void | undefined;
    if (stop) stop();
  }
}

export function addSubscriber(callback: () => void, options?: DataRefresherOptions) {
  const id = nextId++;
  subscribers.set(id, { id, callback, options });
  startIfNeeded();
  return () => {
    subscribers.delete(id);
    stopIfIdle();
  };
}

export function getSubscriberCount() {
  return subscribers.size;
}

export function triggerManualRefresh(reason = 'manual'): Promise<boolean> {
  return tryRefresh(reason);
}
