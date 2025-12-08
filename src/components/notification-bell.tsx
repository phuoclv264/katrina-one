
'use client';
import { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { Bell } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import type { Notification } from '@/lib/types';
import NotificationSheet from './notification-sheet';

export function NotificationBell() {
    const { user, notifications, unreadNotificationCount } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

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
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full status-error opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 status-error border-2 border-background text-white text-[10px] items-center justify-center">
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
