
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
    SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MailQuestion, Check, CalendarCheck, ShieldAlert, CheckCircle2, XCircle, UserCheck, LogIn, LogOut, ClipboardCheck, Megaphone, FileText, DollarSign, FileSignature } from 'lucide-react';
import type { Notification, AuthUser } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { useAuth } from '@/hooks/use-auth';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useDialogContext } from '@/contexts/dialog-context';
import { getNotificationDetails } from '@/lib/notification-utils';

type NotificationSheetProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    notifications: Notification[];
};


export default function NotificationSheet({
    isOpen,
    onOpenChange,
    notifications,
}: NotificationSheetProps) {
    const { user } = useAuth();
    const nav = useAppNavigation();
    const { registerDialog, unregisterDialog } = useDialogContext();

    useEffect(() => {
        if (isOpen) {
            registerDialog();
            return () => unregisterDialog();
        }
    }, [isOpen, registerDialog, unregisterDialog]);

    const handleMarkAllAsRead = async () => {
        if (!user) return;
        await dataStore.markAllNotificationsAsRead(user.uid);
    };

    const handleNotificationClick = async (notification: Notification, details: ReturnType<typeof getNotificationDetails>) => {
        if (!user) return;

        // Mark as read immediately
        if (!notification.isRead || !notification.isRead[user.uid]) {
            dataStore.markNotificationAsRead(notification.id, user.uid); // Mark as read in background
        }

        // Close the sheet
        onOpenChange(false);

        // Navigate
        nav.push(details.href);
    };

    if (!user) return null;

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent className="flex flex-col p-0" side="right">
                <SheetHeader className="p-4 border-b">
                    <SheetTitle>Thông báo</SheetTitle>
                </SheetHeader>

                <ScrollArea className="flex-grow">
                    <div className="p-4 space-y-2">
                        {notifications.length > 0 ? notifications.map(n => {
                            const isRead = n.isRead?.[user.uid] ?? false; // Add nullish coalescing for safety
                            const details = getNotificationDetails(n, user.uid, user.role);
                            const Icon = details.icon;

                            return (
                                <button
                                    key={n.id}
                                    onClick={() => handleNotificationClick(n, details)}
                                    className={cn(
                                        "w-full text-left p-3 rounded-lg border flex items-start gap-3 transition-colors",
                                        isRead ? 'bg-card hover:bg-muted/50' : 'bg-primary/10 hover:bg-primary/20 border-primary/20'
                                    )}
                                >
                                    <div className="relative">
                                        <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", isRead ? "bg-muted" : "bg-primary/20")}>
                                            <Icon className={cn("h-5 w-5", isRead ? "text-muted-foreground" : "text-primary")} />
                                        </div>
                                        {!isRead && (
                                            <div className="absolute top-0 right-0 h-2 w-2 rounded-full bg-blue-500" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-semibold text-sm">{details.title}</p>
                                        <p className="text-sm text-muted-foreground">{details.description}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {formatDistanceToNow(parseISO(n.createdAt as string), { addSuffix: true, locale: vi })}
                                        </p>
                                    </div>
                                </button>
                            )
                        }) : (
                            <div className="text-center py-16 text-muted-foreground">
                                <p>Không có thông báo nào.</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <SheetFooter className="p-4 border-t bg-muted/50">
                    <Button variant="outline" className="w-full" onClick={handleMarkAllAsRead}>
                        <Check className="mr-2 h-4 w-4" />
                        Đánh dấu tất cả đã đọc
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
