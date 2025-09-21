
'use client';

import { useEffect, useState } from 'use-sync-external-store/extra';
import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from '@/lib/firebase';
import { useAuth } from './use-auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

export const useFcm = () => {
    const { user } = useAuth();
    const [fcmToken, setFcmToken] = useState<string | null>(null);
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null);

    // Effect to set initial permission status
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setNotificationPermission(Notification.permission);
        }
    }, []);

    // Effect to handle incoming messages
    useEffect(() => {
        if (messaging && notificationPermission === 'granted') {
            const unsubscribe = onMessage(messaging, (payload) => {
                console.log('Foreground Message received. ', payload);
                toast.custom((t) => (
                    <div
                      className={cn(
                        'max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5',
                        t.visible ? 'animate-enter' : 'animate-leave'
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
                            Close
                        </button>
                        </div>
                    </div>
                ));
            });
            return () => unsubscribe();
        }
    }, [notificationPermission]);

    const requestPermissionAndGetToken = async () => {
        if (!messaging || !user) return null;

        try {
            const currentPermission = await Notification.requestPermission();
            setNotificationPermission(currentPermission);
            
            if (currentPermission === 'granted') {
                console.log('Notification permission granted.');
                const vapidKey = 'BFf_P_9P_xI6V8_C1J3g7q_bXjJ7_yB3C9LwN6G2F4H2hJ3eF0tK1sC4vJ3J3jZ7bYnZ9c8V1B6M'; 
                const token = await getToken(messaging, { vapidKey });
                if (token) {
                    console.log('FCM Token:', token);
                    setFcmToken(token);
                    // Save the token to Firestore
                    const userDocRef = doc(db, 'users', user.uid);
                    await setDoc(userDocRef, { fcmToken: token }, { merge: true });
                    return token;
                } else {
                    console.log('No registration token available. Request permission to generate one.');
                    return null;
                }
            } else {
                console.log('Unable to get permission to notify.');
                return null;
            }
        } catch (err) {
            console.error('An error occurred while retrieving token. ', err);
            return null;
        }
    };
    
    return { fcmToken, notificationPermission, requestPermissionAndGetToken };
};
