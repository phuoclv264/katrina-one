
'use client';

import { useEffect, useState, useCallback } from 'react';
import { getToken } from 'firebase/messaging';
import { messaging, db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

export const useFcm = () => {
    const [fcmToken, setFcmToken] = useState<string | null>(null);
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null);

    // Effect to set initial permission status
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setNotificationPermission(Notification.permission);
        }
    }, []);
    
    const requestPermissionAndGetToken = useCallback(async (userId: string) => {
        if (!messaging || !userId) return null;

        try {
            const currentPermission = await Notification.requestPermission();
            setNotificationPermission(currentPermission);
            
            if (currentPermission === 'granted') {
                console.log('Notification permission granted.');
                const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
                if (!vapidKey) {
                    console.error("VAPID key is missing. Please set NEXT_PUBLIC_FIREBASE_VAPID_KEY in your environment variables.");
                    return null;
                }
                
                const token = await getToken(messaging, { vapidKey });
                if (token) {
                    console.log('FCM Token:', token);
                    setFcmToken(token);
                    
                    const userDocRef = doc(db, 'users', userId);
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
    }, []);
    
    return { fcmToken, notificationPermission, requestPermissionAndGetToken };
};
