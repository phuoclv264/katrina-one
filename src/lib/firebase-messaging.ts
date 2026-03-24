'use client';

import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app } from './firebase';
import { dataStore } from './data-store';
import { toast } from '@/components/ui/pro-toast';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import type { Notification } from './types';
import { Device } from '@capacitor/device';
import { getHomePathForRole } from './navigation';
import { getNotificationDetails } from './notification-utils';

/**
 * This is a simplified version of the logic in `notification-sheet.tsx`.
 * It determines the correct navigation href based on the notification payload.
 * It doesn't need to generate user-facing titles or descriptions.
 */
/**
 * Returns the navigation href for a notification using the centralized
 * `getNotificationDetails` helper which also accounts for the current user
 * context (id + role). Falls back to the user's home path when necessary.
 */
const getNavigationHrefForNotification = (
    notification: Notification,
    currentUserId?: string,
    currentUserRole?: string
): string => {
    try {
        const details = getNotificationDetails(notification, currentUserId || '', currentUserRole || '');
        return details.href || getHomePathForRole(notification.payload?.userRole);
    } catch (err) {
        console.error('Error computing notification href', err);
        return getHomePathForRole(notification.payload?.userRole);
    }
};

const addPushNotificationListeners = async (
    userId: string,
    onNotificationReceived: (notification: Notification) => void,
    onNotificationAction: (href: string) => void,
    userRole?: string
) => {
    await PushNotifications.addListener('registration', async token => {
        const deviceId = await Device.getId();
        await dataStore.saveFcmToken(userId, deviceId.identifier, token.value);
    });

    await PushNotifications.addListener('registrationError', err => {
        console.error('Push notification registration error: ', err.error);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', action => {
        if (action.actionId !== 'tap') return;
        const notificationData = action.notification.data?.payload;
        if (!notificationData) return;
        const fullNotification = JSON.parse(notificationData) as Notification;
        const href = getNavigationHrefForNotification(fullNotification, userId, userRole);
        dataStore.markNotificationAsRead(fullNotification.id, userId);
        onNotificationAction(href);
    });
}

const registerPushNotifications = async () => {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
        throw new Error('User denied permissions!');
    }

    const channels = await PushNotifications.listChannels();
    if (channels.channels.length === 0) {
        await PushNotifications.createChannel({
            id: 'katrinaone_default',
            name: 'Katrina One Notification Channel',
            description: 'This is the app main channel for all notifications',
            importance: 5, // Importance level (1-5)
            visibility: 1, // VISIBILITY_PUBLIC
            vibration: true,
        })
    }

    await PushNotifications.register();
}

// This function requests permission and gets the device token.
export const requestNotificationPermission = async (
    userId: string,
    onNotificationReceived: (notification: Notification) => void,
    onNotificationAction: (href: string) => void,
    userRole?: string
) => {
    if (!Capacitor.isNativePlatform()) return;

    try {
        await PushNotifications.removeAllListeners();
        await registerPushNotifications();
        await addPushNotificationListeners(userId, onNotificationReceived, onNotificationAction, userRole);
    } catch (error) {
        toast.error("Không thể đăng ký nhận thông báo.");
    }
    return;
};

/**
 * Unregisters the device from receiving push notifications.
 * This should be called on user logout.
 */
export const unregisterNotifications = async (userId: string) => {
    if (Capacitor.isNativePlatform()) {
        try {
            if (typeof window !== 'undefined') {
                const device = await Device.getId();
                if (userId) {
                    await dataStore.removeFcmToken(userId, device.identifier);
                }
            }
            await PushNotifications.removeAllListeners();
            await PushNotifications.unregister();
        } catch (error) {
            console.error("KrisLee Error unregistering for notifications", error);
        }
    }
};
