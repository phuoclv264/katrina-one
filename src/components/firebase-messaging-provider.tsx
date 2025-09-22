
'use client';

import { useEffect, useCallback } from 'react';
import { useFcm } from '@/hooks/use-fcm';
import { useAuth } from '@/hooks/use-auth';
import { onMessage } from 'firebase/messaging';
import { messaging } from '@/lib/firebase';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';


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
      const timer = setTimeout(() => {
        handleRequestPermission();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [user, handleRequestPermission]);
  
  // Effect to handle incoming messages when app is in foreground
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.Worker && messaging) {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log('Foreground Message received. ', payload);
        toast.custom(
          (t) => (
            <div
              className={cn(
                'max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5',
                t.visible ? 'animate-in fade-in' : 'animate-out fade-out'
              )}
            >
              <div className="flex-1 w-0 p-4">
                <div className="flex items-start">
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {payload.notification?.title}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      {payload.notification?.body}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex border-l border-gray-200">
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Đóng
                </button>
              </div>
            </div>
          ),
          { duration: 7000 }
        );
      });
      return () => unsubscribe();
    }
  }, []);

  return null;
}
