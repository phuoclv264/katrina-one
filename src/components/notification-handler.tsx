'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { requestNotificationPermission, unregisterNotifications } from '@/lib/firebase-messaging';
import { toast } from 'react-hot-toast';
import type { Notification } from '@/lib/types';
import { Capacitor } from '@capacitor/core';
import { useAppNavigation } from '@/contexts/app-navigation-context';

export default function NotificationHandler() {
  const { user } = useAuth();
  const lastUserObject = useRef(user);
  const nav = useAppNavigation();

  const handleNewNotification = useCallback((notification: Notification) => {
    toast.success(JSON.stringify(notification));
  }, []);

  const handleNotificationAction = useCallback((href: string) => {
    if (href) {
      try {
        nav.push(href);
      } catch {
        // Ignore navigation errors from notification actions
      }
    }
  }, [nav]);

  useEffect(() => {
    if (user && (!lastUserObject.current || lastUserObject.current.uid !== user.uid) && Capacitor.isNativePlatform()) {
      lastUserObject.current = user;

      // We only request permission if it hasn't been granted yet.
      // We can also ask later, e.g. after user clicks a button.
  requestNotificationPermission(user.uid, handleNewNotification, handleNotificationAction, user.role);
    } else if (!user && lastUserObject.current) {
      lastUserObject.current = null;
    }
  }, [user, handleNewNotification, handleNotificationAction]);

  return null; // This component does not render anything.
}
