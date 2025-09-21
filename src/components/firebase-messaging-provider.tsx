
'use client';

import { useEffect, useCallback } from 'react';
import { useFcm } from '@/hooks/use-fcm';
import { useAuth } from '@/hooks/use-auth';

export default function FirebaseMessagingProvider() {
  const { user } = useAuth();
  const { requestPermissionAndGetToken } = useFcm();

  const handleRequestPermission = useCallback(() => {
    if (user) {
      requestPermissionAndGetToken(user.uid);
    }
  }, [user, requestPermissionAndGetToken]);

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
  }, []);

  useEffect(() => {
    if (user) {
      // Small delay to let everything initialize after login
      const timer = setTimeout(() => {
        handleRequestPermission();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [user, handleRequestPermission]);

  return null;
}
