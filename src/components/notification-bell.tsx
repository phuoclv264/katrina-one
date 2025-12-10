
'use client';
import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Bell } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import type { Notification } from '@/lib/types';
import NotificationSheet from './notification-sheet';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { getNotificationDetails } from '@/lib/notification-utils';
import { dataStore } from '@/lib/data-store';

export function NotificationBell() {
    const { user, notifications, unreadNotificationCount } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();
    const processedNotifications = useRef(new Set());

    useEffect(() => {
        if (!user || !notifications) return;

        const unreadNotifications = notifications.filter(n => !n.isRead?.[user.uid]);

        unreadNotifications.forEach(notification => {
            if (processedNotifications.current.has(notification.id)) return;

            const details = getNotificationDetails(notification, user.uid, user.role);
            const Icon = details.icon;

            toast.custom((t) => (
                <div
                    className={`${t.visible ? 'animate-enter' : 'animate-leave'
                        } max-w-md w-full bg-background shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
                >
                    <button
                        onClick={async () => {
                            toast.dismiss(t.id);
                            if (!notification.isRead || !notification.isRead[user.uid]) {
                                await dataStore.markNotificationAsRead(notification.id, user.uid);
                            }
                            router.push(details.href);
                        }}
                        className="flex-1 w-0 p-4 text-left"
                    >
                        <div className="flex items-start">
                            <div className="flex-shrink-0 pt-0.5">
                                <Icon className="h-6 w-6 text-primary" />
                            </div>
                            <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-foreground">
                                    {details.title}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {details.description}
                                </p>
                            </div>
                        </div>
                    </button>
                    <div className="flex border-l border-border">
                        <button
                            onClick={() => toast.dismiss(t.id)}
                            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-primary hover:text-primary-focus focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            ), {
                id: notification.id,
                duration: 6000,
            });

            processedNotifications.current.add(notification.id);
        });

    }, [notifications, user, router]);


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
