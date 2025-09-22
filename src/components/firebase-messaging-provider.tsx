
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
