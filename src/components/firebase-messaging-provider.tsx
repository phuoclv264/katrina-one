
'use client';

import { useEffect } from 'react';
import { useFcm } from '@/hooks/use-fcm';
import { useAuth } from '@/hooks/use-auth';

export default function FirebaseMessagingProvider() {
  const { user } = useAuth();
  const { requestPermissionAndGetToken } = useFcm();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker
        .register('/firebase-messaging-sw.js')
        .then(registration => {
          console.log('Service Worker registration successful, scope is:', registration.scope);
        })
        .catch(err => {
          console.log('Service Worker registration failed, error:', err);
        });
    }

    if (user) {
      // Small delay to ensure everything is initialized
      setTimeout(() => {
        requestPermissionAndGetToken();
      }, 2000);
    }
  }, [user, requestPermissionAndGetToken]);

  // This component doesn't render anything to the DOM
  return null;
}
