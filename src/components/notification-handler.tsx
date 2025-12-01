'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { requestNotificationPermission, unregisterNotifications } from '@/lib/firebase-messaging';
import { toast } from 'react-hot-toast';
import type { Notification } from '@/lib/types';
import { Capacitor } from '@capacitor/core';

export default function NotificationHandler() {
  const { user } = useAuth();
  const lastUserObject = useRef(user);

  const handleNewNotification = useCallback((notification: Notification) => {
    toast.success(JSON.stringify(notification));
  }, []);

  useEffect(() => {
    if (user && (!lastUserObject.current || lastUserObject.current.uid !== user.uid) && Capacitor.isNativePlatform()) {
      lastUserObject.current = user;

      // We only request permission if it hasn't been granted yet.
      // We can also ask later, e.g. after user clicks a button.
      requestNotificationPermission(user.uid, handleNewNotification);
    } else if (!user && lastUserObject.current) {
      lastUserObject.current = null;
    }
  }, [user]);

  return null; // This component does not render anything.
}
