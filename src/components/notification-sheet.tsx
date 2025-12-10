
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
import { useRouter } from 'nextjs-toploader/app';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useDialogContext } from '@/contexts/dialog-context';

type NotificationSheetProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    notifications: Notification[];
};

const getNotificationDetails = (notification: Notification, currentUserId: string, currentUserRole: string) => {
    const { payload, type: notificationType, status, messageTitle, messageBody } = notification;

    switch (notificationType) {
        case 'pass_request': {
            const isMyRequest = payload.requestingUser.userId === currentUserId;
            switch (status) {
                case 'pending':
                    if (payload.targetUserId) {
                        return {
                            icon: MailQuestion,
                            title: isMyRequest ? 'Đang chờ trả lời...' : (payload.isSwapRequest ? 'Yêu cầu đổi ca' : 'Yêu cầu nhận ca'),
                            description: isMyRequest ? `Đã gửi yêu cầu đến ${payload.targetUserName}.` : `${payload.requestingUser.userName} muốn ${payload.isSwapRequest ? 'đổi ca' : 'nhờ bạn nhận ca'}.`,
                            href: `/schedule?openPassRequest=true`,
                        };
                    }
                    return {
                        icon: MailQuestion,
                        title: isMyRequest ? 'Đang tìm người nhận ca...' : 'Có ca cần người nhận',
                        description: isMyRequest ? `Yêu cầu pass ca của bạn đang được hiển thị cho mọi người.` : `${payload.requestingUser.userName} muốn pass ca ${payload.shiftLabel}.`,
                        href: currentUserRole === 'Chủ nhà hàng' ? `/shift-scheduling?openPassRequest=true` : `/schedule?openPassRequest=true`,
                    };
                case 'pending_approval':
                    return {
                        icon: UserCheck,
                        title: 'Chờ quản lý duyệt',
                        description: `${payload.takenBy.userName} đã nhận ca của ${payload.requestingUser.userName}.`,
                        href: `/shift-scheduling?openPassRequest=true`,
                    };
                case 'resolved':
                    return {
                        icon: CheckCircle2,
                        title: 'Yêu cầu đã được duyệt',
                        description: `Yêu cầu pass ca ngày ${format(parseISO(payload.shiftDate), 'dd/MM')} đã được phê duyệt.`,
                        href: `/schedule?openPassRequest=true`,
                    };
                case 'cancelled':
                    return {
                        icon: XCircle,
                        title: 'Yêu cầu đã bị hủy',
                        description: payload.cancellationReason || `Yêu cầu pass ca ngày ${format(parseISO(payload.shiftDate), 'dd/MM')} đã bị hủy.`,
                        href: `/schedule?openPassRequest=true`,
                    };
                default:
                    return { icon: MailQuestion, title: 'Yêu cầu Pass ca', description: 'Cập nhật trạng thái yêu cầu pass ca.', href: '/schedule?openPassRequest=true' };
            }
        }
        case 'new_schedule':
        case 'schedule_changed':
        case 'schedule_proposal':
            return {
                icon: CalendarCheck,
                title: messageTitle,
                description: messageBody,
                href: `/schedule`,
            };
        case 'new_violation':
            return {
                icon: ShieldAlert,
                title: messageTitle,
                description: messageBody,
                href: `/violations?highlight=${payload.violationId}`,
            };
        case 'attendance_update':
            return {
                icon: messageTitle!.includes('Check-in') ? LogIn : LogOut,
                title: messageTitle,
                description: messageBody,
                href: '/attendance',
            };
        case 'new_task_report':
            return {
                icon: ClipboardCheck,
                title: messageTitle,
                description: messageBody,
                href: payload.url || '/reports',
            };
        case 'new_monthly_task_report': {
            const hrefBase = '/monthly-task-reports';
            const qs: string[] = [];
            const completionId: string | undefined = payload?.completionId;
            if (completionId) {
                const ym = completionId.slice(0, 7);
                qs.push(`month=${ym}`);
                qs.push(`highlight=${completionId}`);
            } else if (payload?.assignedDate) {
                const ym = (payload.assignedDate as string).slice(0, 7);
                qs.push(`month=${ym}`);
            }
            return {
                icon: ClipboardCheck,
                title: messageTitle,
                description: messageBody,
                href: qs.length ? `${hrefBase}?${qs.join('&')}` : hrefBase,
            };
        }
        case 'new_whistleblowing_report':
            return {
                icon: Megaphone,
                title: messageTitle,
                description: messageBody,
                href: '/reports-feed',
            };
        case 'new_expense_slip':
            return {
                icon: DollarSign,
                title: messageTitle,
                description: messageBody,
                href: `/reports/cashier?highlight=expense-${payload.slipId}`,
            };
        case 'new_revenue_stats':
            return {
                icon: DollarSign,
                title: messageTitle,
                description: messageBody,
                href: `/reports/cashier?highlight=revenue-${payload.statsId}`,
            };
        case 'new_incident_report':
            return {
                icon: ShieldAlert,
                title: messageTitle,
                description: messageBody,
                href: `/reports/cashier?highlight=incident-${payload.incidentId}`,
            };
        case 'new_cash_handover_report':
            return {
                icon: FileSignature,
                title: messageTitle,
                description: messageBody,
                href: `/reports/cashier?highlight=handover-${payload.reportId}`,
            };
        default:
            return {
                icon: MailQuestion,
                title: messageTitle || 'Thông báo mới',
                description: messageBody || 'Bạn có một thông báo mới.',
                href: '/',
            };
    }
}


export default function NotificationSheet({
    isOpen,
    onOpenChange,
    notifications,
}: NotificationSheetProps) {
    const { user } = useAuth();
    const router = useRouter();
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
            await dataStore.markNotificationAsRead(notification.id, user.uid);
        }

        // Close the sheet
        onOpenChange(false);

        // Navigate
        router.push(details.href);
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
