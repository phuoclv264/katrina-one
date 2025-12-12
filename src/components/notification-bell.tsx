
'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Bell } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import type { Notification } from '@/lib/types';
import NotificationSheet from './notification-sheet';
import { showToast } from './ui/pro-toast';
import { getNotificationDetails } from '@/lib/notification-utils';
import { dataStore } from '@/lib/data-store';
import { useRouter } from 'nextjs-toploader/app';

export function NotificationBell() {
    const { user, notifications, unreadNotificationCount } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const processedNotifications = useRef(new Set());

    const router = useRouter();

    useEffect(() => {
        if (!user || !notifications) return;

        if (processedNotifications.current.size === 0) {
            notifications.forEach(n => processedNotifications.current.add(n.id));
            return;
        }

        const unreadNotifications = notifications.filter(n => !n.isRead?.[user.uid]).reverse();

        unreadNotifications.forEach(notification => {
            if (processedNotifications.current.has(notification.id)) return;

            const details = getNotificationDetails(notification, user.uid, user.role);
            const Icon = details.icon;

            showToast({
                title: details.title ?? 'Thông báo',
                message: details.description ?? '',
                icon: <Icon className="h-5 w-5 text-primary" />,
                type: 'notification',
                duration: 5000,
                onPress: async () => {
                    // Mark as read and navigate to the notification target
                    if (!notification.isRead || !notification.isRead[user.uid]) {
                        await dataStore.markNotificationAsRead(notification.id, user.uid);
                    }
                    if (details.href) {
                        router.push(details.href);
                    }
                },
            });

            processedNotifications.current.add(notification.id);
        });
    }, [notifications, user]);


    if (!user) return null;

    return (
        <>
            <div className="relative">
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
                    <Bell className="h-5 w-5" />
                    <span className="sr-only">Mở thông báo</span>
                </Button>
                {unreadNotificationCount > 0 && (
                    <div className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-background text-white text-[10px] items-center justify-center">
                            {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                        </span>
                    </div>
                )}
            </div>
            <NotificationSheet
                isOpen={isOpen}
                onOpenChange={setIsOpen}
                notifications={notifications || []}
            />
        </>
    );
}
