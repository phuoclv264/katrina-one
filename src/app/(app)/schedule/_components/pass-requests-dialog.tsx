'use client';
import React, { useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogBody,
    DialogAction,
    DialogCancel
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import type { Schedule, ManagedUser, Notification, AuthUser, UserRole, AssignedShift } from '@/lib/types';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ArrowRight, AlertCircle, CheckCircle, XCircle, Undo, Info, UserCheck, Trash2, Calendar, Clock, User as UserIcon, Send, Loader2, UserCog, Replace, ChevronsDownUp, MailQuestion, FileUp, Users, History as HistoryIcon } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogIcon,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { dataStore } from '@/lib/data-store';
import { useAuth } from '@/hooks/use-auth';
import { cn, getInitials } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserAvatar } from '@/components/user-avatar';
import { toast } from '@/components/ui/pro-toast';


type RequestCardProps = {
    notification: Notification;
    schedule: Schedule | null;
    currentUser: AuthUser;
    allUsers: ManagedUser[];
    processingNotificationId: string | null;
    onAccept: (notification: Notification) => void;
    onDecline: (notification: Notification) => void;
    onCancel: (notificationId: string) => void;
    onRevert: (notification: Notification) => void;
    onAssign: (notification: Notification) => void;
    onApprove: (notification: Notification) => void;
    onRejectApproval: (notificationId: string) => void;
    onDeleteHistory: (notificationId: string) => void;
    managerApprovalEnabled: boolean;
};

const RequestCard = ({ notification, schedule, currentUser, allUsers, processingNotificationId, onAccept, onDecline, onCancel, onRevert, onAssign, onApprove, onRejectApproval, onDeleteHistory, managerApprovalEnabled }: RequestCardProps) => {
    const { payload, status, createdAt, resolvedAt, resolvedBy } = notification;
    const isManagerOrOwner = currentUser.role === 'Quản lý' || currentUser.role === 'Chủ nhà hàng';
    const isProcessing = processingNotificationId === notification.id;

    // --- Status and Type Configuration ---
    const getStatusConfig = () => {
        switch (status) {
            case 'pending': return { text: 'Đang chờ', icon: MailQuestion, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500' };
            case 'pending_approval': return { text: 'Chờ duyệt', icon: AlertCircle, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', dot: 'bg-blue-500' };
            case 'resolved': return { text: 'Hoàn tất', icon: CheckCircle, className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot: 'bg-emerald-500' };
            case 'cancelled': return { text: 'Đã hủy', icon: XCircle, className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', dot: 'bg-rose-500' };
            default: return { text: 'Không rõ', icon: Info, className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400', dot: 'bg-slate-500' };
        }
    };

    const getTypeConfig = () => {
        if (payload.isSwapRequest) return { text: 'Đổi ca', Icon: Replace, className: 'bg-indigo-50 text-indigo-600 border-indigo-100/50 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-900/30' };
        if (payload.targetUserId) return { text: 'Nhờ nhận', Icon: Send, className: 'bg-violet-50 text-violet-600 border-violet-100/50 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-900/30' };
        return { text: 'Công khai', Icon: Users, className: 'bg-slate-50 text-slate-600 border-slate-100/50 dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-800' };
    };

    const statusConfig = getStatusConfig();
    const typeConfig = getTypeConfig();
    const TypeIcon = typeConfig.Icon;

    // --- Data Derivation for Display ---
    const {
        requester,
        recipient,
        shiftA,
        shiftB
    } = useMemo(() => {
        const reqUser = allUsers.find(u => u.uid === payload.requestingUser.userId);
        let recUser: ManagedUser | undefined;

        const recipientId = (status === 'pending_approval' && payload.takenBy?.userId)
            || (status === 'resolved' && payload.takenBy?.userId)
            || payload.targetUserId;

        if (recipientId) {
            recUser = allUsers.find(u => u.uid === recipientId);
        }

        const findShiftRole = (label: string, timeSlot: { start: string, end: string }, date: string, userId?: string | null) => {
            const matched = schedule?.shifts.find(s => s.date === date && s.label === label && s.timeSlot.start === timeSlot.start && s.timeSlot.end === timeSlot.end);
            if (!matched) return null;
            if (userId) {
                const assignedEntry = matched.assignedUsers.find(u => u.userId === userId);
                if (assignedEntry && assignedEntry.assignedRole) return assignedEntry.assignedRole;
            }
            return matched.role ?? null;
        };

        const sA = {
            label: payload.shiftLabel,
            timeSlot: payload.shiftTimeSlot,
            date: payload.shiftDate,
            role: findShiftRole(payload.shiftLabel, payload.shiftTimeSlot, payload.shiftDate, payload.requestingUser?.userId),
        };

        let sB: { label: string, timeSlot: { start: string, end: string }, date: string, role?: string | null } | null = null;
        if (payload.isSwapRequest && payload.targetUserShiftPayload) {
            sB = {
                label: payload.targetUserShiftPayload.shiftLabel,
                timeSlot: payload.targetUserShiftPayload.shiftTimeSlot,
                date: payload.targetUserShiftPayload.date,
                role: findShiftRole(payload.targetUserShiftPayload.shiftLabel, payload.targetUserShiftPayload.shiftTimeSlot, payload.targetUserShiftPayload.date, payload.targetUserId),
            };
        }

        return { requester: reqUser, recipient: recUser, shiftA: sA, shiftB: sB };
    }, [payload, allUsers, status, schedule?.shifts]);

    const metadataText = useMemo(() => {
        if (status === 'resolved' && resolvedBy && resolvedAt) {
            return `Giải quyết bởi ${resolvedBy.userName} lúc ${format(new Date(resolvedAt as string), 'HH:mm')}`;
        }
        if (status === 'cancelled' && payload.cancellationReason) {
            if (payload.cancellationReason === 'Hủy bởi quản lý' && resolvedBy) {
                const resolverDetails = allUsers.find(u => u.uid === resolvedBy.userId);
                const resolverRole = resolverDetails?.role || 'Nhân viên';
                return `Hủy bởi ${resolverRole}: ${resolvedBy.userName}`;
            }
            return `Lý do: ${payload.cancellationReason}`;
        }
        if (status === 'pending_approval' && payload.takenBy) {
            return `${payload.takenBy.userName} đã nhận (Chờ duyệt)`;
        }
        if (payload.declinedBy && payload.declinedBy.length > 0) {
            return `${payload.declinedBy.length} người đã từ chối`;
        }
        return `Tạo lúc ${format(parseISO(createdAt as string), 'HH:mm')}`;
    }, [status, resolvedBy, resolvedAt, payload, createdAt, allUsers]);

    const UserBlock = ({ user, shift, label }: { user?: ManagedUser, shift?: { label: string, timeSlot: { start: string, end: string }, date: string, role?: string | null } | null, label: string }) => {
        const shiftLabelWithRole = shift && (shift.role ? `${shift.label} (${shift.role})` : shift?.label);
        const shiftInfoText = shift ? `${shiftLabelWithRole} • ${shift.timeSlot.start}-${shift.timeSlot.end}` : 'Không có ca';
        const dateText = shift ? format(parseISO(shift.date), 'eee, dd/MM', { locale: vi }) : '';

        return (
            <div className="flex items-start gap-3 flex-1 min-w-0">
                <UserAvatar user={user} size="h-10 w-10 sm:h-12 sm:w-12" className="ring-2 ring-primary/5" />
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
                    <p className="text-sm font-bold text-foreground" title={user?.displayName || "Chưa xác định"}>
                        {user?.displayName || "Trống"}
                    </p>
                    {shift && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-[11px] font-medium text-muted-foreground">{shiftInfoText}</span>
                            <Badge variant="secondary" className="h-4.5 px-1.5 text-[9px] font-bold rounded-md bg-muted/50">
                                {dateText}
                            </Badge>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const isMyRequest = payload.requestingUser.userId === currentUser.uid;
    const isDirectRequestToMe = status === 'pending' && payload.targetUserId === currentUser.uid;

    const ActionButton = ({ onClick, variant = "default", icon: Icon, children, disabled }: { onClick: () => void, variant?: any, icon?: any, children: React.ReactNode, disabled?: boolean }) => (
        <Button 
            size="sm" 
            variant={variant} 
            onClick={onClick} 
            disabled={disabled || isProcessing}
            className="h-9 px-3 sm:h-10 sm:px-4 font-bold rounded-xl flex-1 sm:flex-initial min-w-[80px] sm:min-w-[100px] text-[11px] sm:text-sm"
        >
            {isProcessing ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : Icon && <Icon className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            {children}
        </Button>
    );

    const renderActions = () => {
        if (isDirectRequestToMe) {
            return (
                <div className="flex gap-2 w-full sm:w-auto">
                    <ActionButton variant="outline" icon={XCircle} onClick={() => onDecline(notification)}>Từ chối</ActionButton>
                    <ActionButton icon={CheckCircle} onClick={() => onAccept(notification)}>
                        {payload.isSwapRequest ? 'Đồng ý' : 'Nhận ca'}
                    </ActionButton>
                </div>
            );
        }

        if (isManagerOrOwner) {
            if (status === 'pending_approval') {
                const isRequestByManager = allUsers.find(u => u.uid === payload.requestingUser.userId)?.role === 'Quản lý';
                const isTakenByManager = payload.takenBy && allUsers.find(u => u.uid === payload.takenBy.userId)?.role === 'Quản lý';
                const canOwnerApprove = currentUser.role === 'Chủ nhà hàng';
                const canManagerApproveByRole = currentUser.role === 'Quản lý' && !isRequestByManager && !isTakenByManager;

                const showManagerDisabledAlert = () => {
                    toast.error("Không thể phê duyệt", {message: 'Chủ quán đã tắt tính năng duyệt của bạn, liên hệ chủ quán để được mở lại'});
                };

                if (canOwnerApprove) {
                    return (
                        <div className="flex gap-2 w-full sm:w-auto">
                            <ActionButton variant="destructive" icon={XCircle} onClick={() => onRejectApproval(notification.id)}>Từ chối</ActionButton>
                            <ActionButton icon={CheckCircle} onClick={() => onApprove(notification)}>Phê duyệt</ActionButton>
                        </div>
                    );
                }

                if (canManagerApproveByRole) {
                    if (!managerApprovalEnabled) {
                        return (
                            <div className="flex gap-2 w-full sm:w-auto">
                                <ActionButton variant="destructive" icon={XCircle} onClick={showManagerDisabledAlert}>Từ chối</ActionButton>
                                <ActionButton icon={CheckCircle} onClick={showManagerDisabledAlert}>Phê duyệt</ActionButton>
                            </div>
                        );
                    }
                    return (
                        <div className="flex gap-2 w-full sm:w-auto">
                            <ActionButton variant="destructive" icon={XCircle} onClick={() => onRejectApproval(notification.id)}>Từ chối</ActionButton>
                            <ActionButton icon={CheckCircle} onClick={() => onApprove(notification)}>Phê duyệt</ActionButton>
                        </div>
                    );
                }
            }
            if (status === 'pending' && currentUser.role === 'Chủ nhà hàng' && (!payload.targetUserId || !payload.isSwapRequest)) {
                return (
                    <div className="flex gap-2 w-full sm:w-auto">
                        <ActionButton variant="secondary" icon={UserCheck} onClick={() => onAssign(notification)}>Chỉ định</ActionButton>
                        <AlertDialog dialogTag="alert-dialog" parentDialogTag="root" variant="destructive">
                            <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive" disabled={isProcessing} className="h-9 px-3 sm:h-10 sm:px-4 font-bold rounded-xl flex-1 sm:flex-initial text-[11px] sm:text-sm">
                                    {isProcessing ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <Trash2 className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                                    Hủy
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <DialogTitle>Hủy yêu cầu?</DialogTitle>
                                    <DialogDescription>Hành động này sẽ hủy yêu cầu và không thể hoàn tác.</DialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Bỏ qua</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onCancel(notification.id)}>Xác nhận Hủy</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                );
            }
        }

        if (status === 'pending' && !isMyRequest) {
            const isManagerViewing = currentUser.role === 'Quản lý' || currentUser.role === 'Chủ nhà hàng';
            if (isManagerViewing && !payload.targetUserId && !payload.isSwapRequest && payload.requestingUser.userId !== currentUser.uid) {
                return (
                    <ActionButton icon={CheckCircle} onClick={() => onAccept(notification)}>Nhận ca</ActionButton>
                )
            } else if (!payload.targetUserId) {
                return (
                    <div className="flex gap-2 w-full sm:w-auto">
                        <ActionButton variant="outline" icon={XCircle} onClick={() => onDecline(notification)}>Bỏ qua</ActionButton>
                        <ActionButton icon={CheckCircle} onClick={() => onAccept(notification)}>Nhận ca</ActionButton>
                    </div>
                )
            }
        }

        if (status === 'pending' && isMyRequest) {
            return (
                <div className="flex justify-end w-full sm:w-auto">
                    <ActionButton variant="outline" onClick={() => onCancel(notification.id)}>Hủy yêu cầu</ActionButton>
                </div>
            );
        }

        if (isManagerOrOwner) {
            if (status === 'resolved' && currentUser.role === 'Chủ nhà hàng') {
                return (
                    <div className="flex gap-2 w-full sm:w-auto justify-end">
                        <AlertDialog dialogTag="alert-dialog" parentDialogTag="root" variant="warning">
                            <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" disabled={isProcessing} className="h-9 px-3 sm:h-10 sm:px-4 font-bold rounded-xl text-[11px] sm:text-sm">
                                    {isProcessing ? <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" /> : <Undo className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                                    Hoàn tác
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <DialogTitle>Hoàn tác yêu cầu?</DialogTitle>
                                    <DialogDescription>Khôi phục trạng thái nhận ca của yêu cầu này.</DialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Thoát</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onRevert(notification)}>Đồng ý</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog dialogTag="alert-dialog" parentDialogTag="root" variant="destructive">
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive h-9 w-9 sm:h-10 sm:w-10 rounded-xl hover:bg-destructive/10">
                                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <DialogTitle>Xóa vĩnh viễn?</DialogTitle>
                                    <DialogDescription>Hành động này sẽ xóa hoàn toàn thông báo khỏi lịch sử.</DialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDeleteHistory(notification.id)}>Xóa</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                );
            }
            if (status === 'cancelled' && currentUser.role === 'Chủ nhà hàng') {
                return (
                    <div className="flex justify-end w-full">
                        <AlertDialog dialogTag="alert-dialog" parentDialogTag="root" variant="destructive">
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive h-9 w-9 sm:h-10 sm:w-10 rounded-xl hover:bg-destructive/10">
                                    <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <DialogTitle>Xóa vĩnh viễn?</DialogTitle>
                                    <DialogDescription>Hành động này sẽ xóa hoàn toàn thông báo khỏi lịch sử.</DialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDeleteHistory(notification.id)}>Xóa</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                );
            }
        }

        return null;
    }

    const actions = renderActions();

    return (
        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-none bg-card rounded-[20px] sm:rounded-[24px] transition-all hover:shadow-md hover:shadow-primary/5">
            <div className="p-3.5 sm:p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <Badge className={cn("h-5.5 sm:h-6 px-2 sm:px-2.5 rounded-full border border-transparent font-bold text-[9px] sm:text-[10px] tracking-tight uppercase", typeConfig.className)}>
                            <TypeIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 sm:mr-1.5" />
                            {typeConfig.text}
                        </Badge>
                        <div className={cn("flex items-center gap-1 sm:gap-1.5 h-5.5 sm:h-6 px-2 sm:px-2.5 rounded-full font-bold text-[9px] sm:text-[10px] tracking-tight uppercase", statusConfig.className)}>
                            <div className={cn("w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full", statusConfig.dot)} />
                            {statusConfig.text}
                        </div>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{metadataText}</span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-6 bg-muted/30 dark:bg-muted/10 p-3 sm:p-4 rounded-[16px] sm:rounded-[20px] border border-slate-100 dark:border-slate-800/50">
                    <UserBlock user={requester} shift={shiftA} label="Người gửi" />

                    <div className="flex sm:flex-col items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-0">
                        <div className="h-px sm:w-px flex-1 bg-slate-200 dark:bg-slate-700/50 min-w-[12px] sm:min-h-[16px]" />
                        {payload.isSwapRequest ? (
                            <Replace className="w-4 h-4 sm:w-5 sm:h-5 text-primary/40 rotate-90 sm:rotate-0" />
                        ) : (
                            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-primary/40 rotate-90 sm:rotate-0" />
                        )}
                        <div className="h-px sm:w-px flex-1 bg-slate-200 dark:bg-slate-700/50 min-w-[12px] sm:min-h-[16px]" />
                    </div>

                    {payload.isSwapRequest ? (
                        <UserBlock user={recipient} shift={shiftB} label="Đổi với" />
                    ) : recipient ? (
                        <UserBlock user={recipient} shift={null} label="Người nhận" />
                    ) : (
                        <div className="flex items-start gap-3 flex-1 min-w-0 opacity-60">
                            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-700">
                                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Đối tượng</p>
                                <p className="text-[13px] sm:text-sm font-bold text-slate-500">Mọi người (Công khai)</p>
                            </div>
                        </div>
                    )}
                </div>

                {actions && (
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                        {actions}
                    </div>
                )}
            </div>
        </Card>
    );
};


type PassRequestsDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    notifications: Notification[];
    allUsers: ManagedUser[];
    weekInterval: { start: Date; end: Date };
    onAccept: (notification: Notification) => void;
    onDecline: (notification: Notification) => void;
    onCancel: (notificationId: string) => void;
    onRevert: (notification: Notification) => void;
    onAssign: (notification: Notification) => void;
    onApprove: (notification: Notification) => void;
    onRejectApproval: (notificationId: string) => void;
    processingNotificationId: string | null;
    schedule: Schedule | null;
    parentDialogTag: string;
}


export default function PassRequestsDialog({
    isOpen,
    onClose,
    notifications,
    allUsers,
    weekInterval,
    onAccept,
    onDecline,
    onCancel,
    onRevert,
    onAssign,
    onApprove,
    onRejectApproval,
    processingNotificationId,
    schedule,
    parentDialogTag,
}: PassRequestsDialogProps) {
    const { user: currentUser } = useAuth();
    const [managerApprovalEnabled, setManagerApprovalEnabled] = React.useState(true);

    React.useEffect(() => {
        const unsubscribe = dataStore.subscribeToAppSettings((settings) => {
            setManagerApprovalEnabled(settings.managerApprovalEnabled !== false);
        });
        return unsubscribe;
    }, []);

    const handleToggleManagerApproval = async (enabled: boolean) => {
        setManagerApprovalEnabled(enabled);
        try {
            await dataStore.updateAppSettings({ managerApprovalEnabled: enabled });
            toast.success('Đã cập nhật', {message: enabled ? 'Quản lý có thể phê duyệt yêu cầu.' : 'Đã tắt quyền phê duyệt của Quản lý.'});
        } catch (error) {
            toast.error("Lỗi", {message: "Không thể cập nhật cài đặt. Vui lòng thử lại."})
            setManagerApprovalEnabled(!enabled);
        }
    };

    const isManagerOrOwner = currentUser?.role === 'Quản lý' || currentUser?.role === 'Chủ nhà hàng';

    const { pendingRequests, historicalRequests } = useMemo(() => {
        if (!currentUser) return { pendingRequests: [], historicalRequests: [] };

        const pending: Notification[] = [];
        const historical: Notification[] = [];

        const weekFilteredNotifications = notifications.filter(notification => {
            if (notification.type !== 'pass_request') return false;
            const shiftDate = parseISO(notification.payload.shiftDate);
            return isWithinInterval(shiftDate, weekInterval);
        });

        weekFilteredNotifications.forEach(notification => {
            const payload = notification.payload;
            const isMyRequest = payload.requestingUser.userId === currentUser.uid;
            const didITakeTheShift = payload.takenBy?.userId === currentUser.uid;
            const wasTargetedToMe = payload.targetUserId === currentUser.uid;

            if (notification.status === 'pending' || notification.status === 'pending_approval') {
                const isRequestByManager = allUsers.find(u => u.uid === payload.requestingUser.userId)?.role === 'Quản lý';
                const isTakenByManager = payload.takenBy && allUsers.find(u => u.uid === payload.takenBy.userId)?.role === 'Quản lý';

                if (notification.status === 'pending' && wasTargetedToMe) {
                    pending.push(notification);
                    return;
                }

                if (isManagerOrOwner) {
                    // Manager can see pending/pending_approval if it doesn't involve another manager, unless they are the owner
                    if (currentUser.role === 'Chủ nhà hàng' || (!isRequestByManager && !isTakenByManager)) {
                        pending.push(notification);
                        return;
                    }
                }

                if (isMyRequest) {
                    pending.push(notification);
                    return;
                }

                if (notification.status === 'pending_approval' && didITakeTheShift) {
                    pending.push(notification);
                    return;
                }

                if (notification.status === 'pending') {
                    const isPublicRequest = !payload.targetUserId;

                    if (isPublicRequest) {
                        const isDifferentRole = payload.shiftRole !== 'Bất kỳ' && currentUser.role !== payload.shiftRole && !currentUser.secondaryRoles?.includes(payload.shiftRole as UserRole);
                        const hasDeclined = (payload.declinedBy || []).includes(currentUser.uid);
                        if (!isDifferentRole && !hasDeclined) {
                            pending.push(notification);
                        }
                    }
                }
            } else {
                if (isManagerOrOwner) {
                    historical.push(notification);
                } else {
                    if (isMyRequest || didITakeTheShift || wasTargetedToMe) {
                        historical.push(notification);
                    }
                }
            }
        });

        pending.sort((a, b) => {
            const dateA = new Date(`${a.payload.shiftDate}T${a.payload.shiftTimeSlot.start}`);
            const dateB = new Date(`${b.payload.shiftDate}T${b.payload.shiftTimeSlot.end}`);
            return dateA.getTime() - dateB.getTime();
        });

        historical.sort((a, b) => {
            const timeA = a.resolvedAt || a.createdAt;
            const timeB = b.resolvedAt || b.createdAt;
            return new Date(timeB as string).getTime() - new Date(timeA as string).getTime();
        });

        return { pendingRequests: pending, historicalRequests: historical };
    }, [notifications, currentUser, allUsers, weekInterval, isManagerOrOwner]);

    const handleDeleteFromHistory = async (notificationId: string) => {
        if (currentUser?.role !== 'Chủ nhà hàng') return;
        try {
            await dataStore.deletePassRequestNotification(notificationId);
            toast.success("Thành công", {message: "Đã xóa yêu cầu khỏi lịch sử."})
        } catch (error) {
            toast.error("Lỗi", {message: "Không thể xóa yêu cầu."})
        }
    }

    if (!currentUser) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose} dialogTag="pass-requests-dialog" parentDialogTag={parentDialogTag}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader variant="premium" iconkey="send">
                    <DialogTitle className="text-lg sm:text-xl">Quản lý Pass ca</DialogTitle>
                    <DialogDescription className="font-bold uppercase tracking-widest text-[9px] sm:text-[10px]">
                        Tuần từ {format(weekInterval.start, 'dd/MM')} đến {format(weekInterval.end, 'dd/MM/yyyy')}
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="p-0 flex flex-col overflow-hidden bg-slate-50/30 dark:bg-slate-900/10">
                    {currentUser.role === 'Chủ nhà hàng' && (
                        <div className="px-4 sm:px-5 pt-3 pb-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <UserCog className="h-4 w-4 text-muted-foreground" />
                                <span className="text-[11px] sm:text-[12px] font-bold">Cho phép Quản lý phê duyệt yêu cầu</span>
                            </div>
                            <Switch checked={managerApprovalEnabled} onCheckedChange={handleToggleManagerApproval} />
                        </div>
                    )}
                    <Tabs defaultValue="pending" className="flex flex-col flex-1 overflow-hidden">
                        <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-2 sm:pb-3 bg-background/50 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800/50">
                            <TabsList className="grid w-full grid-cols-2 h-10 sm:h-11 p-1 bg-muted/50 rounded-xl">
                                <TabsTrigger
                                    value="pending"
                                    className="rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-sm"
                                >
                                    Đang chờ
                                    {pendingRequests.length > 0 && (
                                        <Badge variant="default" className="ml-1.5 sm:ml-2 h-4 sm:h-4.5 px-1 sm:px-1.5 rounded-md text-[8px] sm:text-[9px] bg-primary text-primary-foreground shadow-sm shrink-0">
                                            {pendingRequests.length}
                                        </Badge>
                                    )}
                                </TabsTrigger>
                                <TabsTrigger
                                    value="history"
                                    className="rounded-lg text-[10px] sm:text-[11px] font-bold uppercase tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-sm"
                                >
                                    Lịch sử
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1">
                            <TabsContent value="pending" className="m-0 p-3.5 sm:p-5 space-y-3 sm:space-y-4">
                                {pendingRequests.length > 0 ? (
                                    <div className="space-y-3 sm:space-y-4 pb-6">
                                        {pendingRequests.map(notification => (
                                            <RequestCard
                                                key={notification.id}
                                                notification={notification}
                                                schedule={schedule}
                                                currentUser={currentUser}
                                                allUsers={allUsers}
                                                processingNotificationId={processingNotificationId}
                                                onAccept={onAccept}
                                                onDecline={onDecline}
                                                onCancel={onCancel}
                                                onRevert={onRevert}
                                                onAssign={onAssign}
                                                onApprove={onApprove}
                                                onRejectApproval={onRejectApproval}
                                                onDeleteHistory={handleDeleteFromHistory}
                                                managerApprovalEnabled={managerApprovalEnabled}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center px-4">
                                        <div className="h-14 w-14 sm:h-16 sm:w-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                                            <CheckCircle className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-500" />
                                        </div>
                                        <p className="text-sm font-bold text-foreground">Bạn đã hoàn thành mọi thứ!</p>
                                        <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-widest mt-1">Không có yêu cầu nào cần xử lý</p>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="history" className="m-0 p-3.5 sm:p-5 space-y-3 sm:space-y-4">
                                {historicalRequests.length > 0 ? (
                                    <div className="space-y-3 sm:space-y-4 pb-10">
                                        {historicalRequests.map(notification => (
                                            <RequestCard
                                                key={notification.id}
                                                notification={notification}
                                                schedule={schedule}
                                                currentUser={currentUser}
                                                allUsers={allUsers}
                                                processingNotificationId={processingNotificationId}
                                                onAccept={onAccept}
                                                onDecline={onDecline}
                                                onCancel={onCancel}
                                                onRevert={onRevert}
                                                onAssign={onAssign}
                                                onApprove={onApprove}
                                                onRejectApproval={onRejectApproval}
                                                onDeleteHistory={handleDeleteFromHistory}
                                                managerApprovalEnabled={managerApprovalEnabled}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center px-4">
                                        <div className="h-14 w-14 sm:h-16 sm:w-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                                            <HistoryIcon className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground/40" />
                                        </div>
                                        <p className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Lịch sử trống</p>
                                    </div>
                                )}
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>
                </DialogBody>

                <DialogFooter variant="muted">
                    <DialogCancel className="w-full sm:w-auto">ĐÓNG</DialogCancel>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
