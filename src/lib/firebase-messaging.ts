
'use client';

import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app } from './firebase';
import { dataStore } from './data-store';
import { toast } from '@/components/ui/pro-toast';

// This function requests permission and gets the device token.
export const requestNotificationPermission = async (userId: string) => {
    console.log('Requesting notification permission...');

    // Check if browser supports Firebase Messaging
    const supported = await isSupported();
    if (!supported) {
        console.log('This browser does not support Firebase Messaging.');
        return;
    }

    const messaging = getMessaging(app);

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
        console.error("Firebase VAPID key is not configured in environment variables (NEXT_PUBLIC_FIREBASE_VAPID_KEY).");
        toast.error("Cấu hình thông báo bị thiếu. Không thể đăng ký nhận thông báo.");
        return;
    }

    try {
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            console.log('Notification permission granted.');
            const currentToken = await getToken(messaging, {
                vapidKey: vapidKey,
            });

            if (currentToken) {
                console.log('FCM Token:', currentToken);
                // Save the token to Firestore for this user
                await dataStore.saveFcmToken(userId, currentToken);
            } else {
                console.log('No registration token available. Request permission to generate one.');
            }
        } else {
            console.log('Unable to get permission to notify.');
        }
    } catch (error) {
        console.error('An error occurred while retrieving token. ', error);
        toast.error("Không thể đăng ký nhận thông báo. Vui lòng kiểm tra cài đặt trình duyệt của bạn.");
    }
};

// This function sets up a listener for messages that are received while the app is in the foreground.
export const onForegroundMessage = (callback: (payload: any) => void) => {
    const messaging = getMessaging(app);
    return onMessage(messaging, callback);
};
