'use client';

import { useEffect } from 'react';
import { addSubscriber, DataRefresherOptions as ManagerOptions } from './data-refresher-manager';

/**
 * Lightweight hook wrapper that registers the caller with the singleton
 * data refresher manager. The manager handles reconnect detection and
 * throttling globally.
 */
export function useDataRefresher(onReconnect: () => void, options?: ManagerOptions) {
  useEffect(() => {
    const unsubscribe = addSubscriber(onReconnect, options);
    return () => unsubscribe();
  }, [onReconnect, options?.minIntervalMs, options?.refreshOnBrowserOnline, options?.refreshOnReturnAfterMs]);
}

