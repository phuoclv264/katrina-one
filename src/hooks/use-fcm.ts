
'use client';

import { useEffect, useState, useCallback } from 'react';
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
                ), { duration: 5000 });
            });
            return () => unsubscribe();
        }
    }, [notificationPermission]);
    
    // Function to be called on user action e.g. button click
    const requestPermissionAndGetToken = useCallback(async () => {
        if (!messaging || !user) return null;

        try {
            const currentPermission = await Notification.requestPermission();
            setNotificationPermission(currentPermission);
            
            if (currentPermission === 'granted') {
                console.log('Notification permission granted.');
                const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
                if (!vapidKey) {
                    console.error("VAPID key is missing. Please set NEXT_PUBLIC_FIREBASE_VAPID_KEY in your environment variables.");
                    toast.error("Lỗi cấu hình: Không tìm thấy VAPID key.");
                    return null;
                }
                
                const token = await getToken(messaging, { vapidKey });
                if (token) {
                    console.log('FCM Token:', token);
                    setFcmToken(token);
                    // Save the token to Firestore
                    const userDocRef = doc(db, 'users', user.uid);
                    await setDoc(userDocRef, { fcmToken: token }, { merge: true });
                    toast.success("Đã bật thông báo!");
                    return token;
                } else {
                    console.log('No registration token available. Request permission to generate one.');
                    toast.error("Không thể lấy token thông báo. Vui lòng thử lại.");
                    return null;
                }
            } else {
                console.log('Unable to get permission to notify.');
                toast.error("Bạn đã từ chối quyền nhận thông báo.");
                return null;
            }
        } catch (err) {
            console.error('An error occurred while retrieving token. ', err);
            toast.error("Đã xảy ra lỗi khi yêu cầu quyền thông báo.");
            return null;
        }
    }, [user]);
    
    // Auto-get token if permission was already granted on login
     useEffect(() => {
        if (user && notificationPermission === 'granted') {
            requestPermissionAndGetToken();
        }
    }, [user, notificationPermission, requestPermissionAndGetToken]);
    
    return { fcmToken, notificationPermission, requestPermissionAndGetToken };
};
