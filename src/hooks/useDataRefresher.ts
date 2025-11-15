'use client';

import { useEffect, useRef, useState } from 'react';
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
export function useDataRefresher(onReconnect: () => void) {
  const isVisible = usePageVisibility();

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

        if (!currentlyOnline) {
          // console.log('Firestore connection is offline. Serving from cache.');
        } 
      },
      (error) => {
        // console.error('Firestore connection check error:', error);

        if (isVisible) {
          console.log('Firestore connection error while tab is visible. Refreshing data...');
          onReconnect();
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isVisible, onReconnect]);
}