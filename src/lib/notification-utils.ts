import {
    MailQuestion,
    UserCheck,
    UserX,
    FileText,
    ClipboardCheck,
    Megaphone,
    DollarSign,
    ShieldAlert,
    FileSignature,
    type LucideIcon,
    CalendarCheck,
    LogIn,
    LogOut,
    CheckCircle2,
    XCircle,
} from 'lucide-react';
import type { Notification } from '@/lib/types';
import { format, parseISO } from 'date-fns';

export const getNotificationDetails = (notification: Notification, currentUserId: string, currentUserRole: string) => {
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
