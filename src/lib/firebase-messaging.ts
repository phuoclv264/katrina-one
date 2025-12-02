'use client';

import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { app } from './firebase';
import { dataStore } from './data-store';
import { toast } from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import type { Notification } from './types';
import { Device } from '@capacitor/device';
import { getHomePathForRole } from './navigation';

/**
 * This is a simplified version of the logic in `notification-sheet.tsx`.
 * It determines the correct navigation href based on the notification payload.
 * It doesn't need to generate user-facing titles or descriptions.
 */
const getNavigationHrefForNotification = (notification: Notification): string => {
    const { type, payload, status } = notification;

    switch (type) {
        case 'pass_request':
            // For any pass request, the destination is the schedule page with the dialog open.
            // The specific view (employee/manager) is handled by the app's routing.
            return `/schedule?openPassRequest=true`;
        case 'new_schedule':
        case 'schedule_changed':
        case 'schedule_proposal':
            return `/schedule`;
        case 'new_violation':
            return `/violations?highlight=${payload.violationId}`;
        case 'attendance_update':
            return '/attendance';
        case 'new_task_report':
        case 'new_monthly_task_report':
            return payload.url || '/reports';
        case 'new_whistleblowing_report':
            return '/reports-feed';
        case 'new_expense_slip':
            return `/reports/cashier?highlight=expense-${payload.slipId}`;
        case 'new_revenue_stats':
            return `/reports/cashier?highlight=revenue-${payload.statsId}`;
        case 'new_incident_report':
            return `/reports/cashier?highlight=incident-${payload.incidentId}`;
        case 'new_cash_handover_report':
            return `/reports/cashier?highlight=handover-${payload.reportId}`;
        default:
            // Fallback to a sensible default, like the user's home page.
            return getHomePathForRole(payload?.userRole);
    }
};

const addPushNotificationListeners = async (
    userId: string,
    onNotificationReceived: (notification: Notification) => void,
    onNotificationAction: (href: string) => void
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
        const href = getNavigationHrefForNotification(fullNotification);
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
    onNotificationAction: (href: string) => void
) => {
    if (!Capacitor.isNativePlatform()) return;

    try {
        await PushNotifications.removeAllListeners();
        await registerPushNotifications();
        await addPushNotificationListeners(userId, onNotificationReceived, onNotificationAction);
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
