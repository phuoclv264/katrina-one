'use client';

import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app } from './firebase';
import { dataStore } from './data-store';
import { toast } from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import type { Notification } from './types';
import { Device } from '@capacitor/device';

const addPushNotificationListeners = async (userId: string, onNotificationReceived: (notification: Notification) => void) => {
    await PushNotifications.addListener('registration', async token => {
        const deviceId = await Device.getId();
        await dataStore.saveFcmToken(userId, deviceId.identifier, token.value);
    });

    await PushNotifications.addListener('registrationError', err => {
        console.error('KrisLee Registration error: ', err.error);
    });

    await PushNotifications.addListener('pushNotificationReceived', notification => {
        console.log('KrisLee Push notification received: ', notification.data?.notification);
        if (notification.data?.notification) {
            try {
                const notificationData = JSON.parse(notification.data.notification) as Notification;
                console.log("KrisLee notification data: " + notificationData);
                onNotificationReceived(notificationData);
            } catch (error) {
                console.error("KrisLee Failed to parse notification data from native push:", error);
            }
        }
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', notification => {
        console.log('KrisLee Push notification action performed', notification.actionId, notification.inputValue);
        // Here you can add logic to navigate to a specific screen based on the notification
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

    await PushNotifications.register();
}

// This function requests permission and gets the device token.
export const requestNotificationPermission = async (userId: string, onNotificationReceived: (notification: Notification) => void) => {
    if (!Capacitor.isNativePlatform()) return;

    try {
        await registerPushNotifications();
        await addPushNotificationListeners(userId, onNotificationReceived);
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
