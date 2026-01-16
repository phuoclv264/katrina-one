'use client';
import React, { useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Schedule, ManagedUser, Notification, AuthUser, UserRole, AssignedShift } from '@/lib/types';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ArrowRight, AlertCircle, CheckCircle, XCircle, Undo, Info, UserCheck, Trash2, Calendar, Clock, User as UserIcon, Send, Loader2, UserCog, Replace, ChevronsDownUp, MailQuestion, FileUp, Users } from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { dataStore } from '@/lib/data-store';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { cn, getInitials } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


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
};

const RequestCard = ({ notification, schedule, currentUser, allUsers, processingNotificationId, onAccept, onDecline, onCancel, onRevert, onAssign, onApprove, onRejectApproval, onDeleteHistory }: RequestCardProps) => {
    const { payload, status, createdAt, resolvedAt, resolvedBy } = notification;
    const isManagerOrOwner = currentUser.role === 'Quản lý' || currentUser.role === 'Chủ nhà hàng';
    const isProcessing = processingNotificationId === notification.id;


    // --- Status and Type Configuration ---
    const getStatusConfig = () => {
        switch (status) {
            case 'pending': return { text: 'Đang chờ', icon: MailQuestion, className: 'bg-amber-500/10 text-amber-600', dot: 'bg-amber-500', cardBorder: 'border-amber-100 dark:border-amber-900/30' };
            case 'pending_approval': return { text: 'Chờ duyệt', icon: AlertCircle, className: 'bg-blue-500/10 text-blue-600', dot: 'bg-blue-500', cardBorder: 'border-blue-100 dark:border-blue-900/30' };
            case 'resolved': return { text: 'Đã xong', icon: CheckCircle, className: 'bg-green-500/10 text-green-600', dot: 'bg-green-500', cardBorder: 'border-green-100 dark:border-green-900/30' };
            case 'cancelled': return { text: 'Đã huỷ', icon: XCircle, className: 'bg-red-500/10 text-red-600', dot: 'bg-red-500', cardBorder: 'border-red-100 dark:border-red-900/30' };
            default: return { text: 'Không rõ', icon: Info, className: 'bg-slate-500/10 text-slate-600', dot: 'bg-slate-500', cardBorder: 'border-slate-100' };
        }
    };

    const getTypeConfig = () => {
        if (payload.isSwapRequest) return { text: 'ĐỔI CA', Icon: Replace, className: 'bg-purple-500/10 text-purple-600 border-purple-100 dark:border-purple-900/30' };
        if (payload.targetUserId) return { text: 'NHỜ NHẬN', Icon: Send, className: 'bg-indigo-500/10 text-indigo-600 border-indigo-100 dark:border-indigo-900/30' };
        return { text: 'CÔNG KHAI', Icon: MailQuestion, className: 'bg-slate-500/10 text-slate-600 border-slate-100 dark:border-slate-800' };
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

        // Attempt to resolve shift role from the provided schedule where possible
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
    }, [payload, allUsers, status]);

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
            return `Lý do hủy: ${payload.cancellationReason}`;
        }
        if (status === 'pending_approval' && payload.takenBy) {
            return `${payload.takenBy.userName} đã nhận và đang chờ duyệt`;
        }
        if (payload.declinedBy && payload.declinedBy.length > 0) {
            return `${payload.declinedBy.length} người đã từ chối.`;
        }
        return `Tạo lúc ${format(parseISO(createdAt as string), 'HH:mm')}`;
    }, [status, resolvedBy, resolvedAt, payload, createdAt, allUsers]);

    // --- Helper Components ---
    const UserAvatar = ({ user, size = "h-8 w-8" }: { user?: ManagedUser, size?: string }) => {
        if (!user) return <div className={cn(size, "rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black")}>?</div>;
        return (
            <Avatar className={cn(size, "rounded-lg sm:rounded-xl")}>
                <AvatarImage src={user.photoURL || ""} />
                <AvatarFallback className="bg-slate-100 text-slate-500 font-black text-[10px] uppercase rounded-lg sm:rounded-xl">
                    {getInitials(user.displayName)}
                </AvatarFallback>
            </Avatar>
        );
    }

    const UserBlock = ({ user, shift, label }: { user?: ManagedUser, shift?: { label: string, timeSlot: { start: string, end: string }, date: string, role?: string | null } | null, label: string }) => {
        const shiftLabelWithRole = shift && (shift.role ? `${shift.label} (${shift.role})` : shift?.label);
        const shiftInfoText = shift ? `${shiftLabelWithRole} • ${shift.timeSlot.start}-${shift.timeSlot.end}` : 'Không có ca';
        const dateText = shift ? format(parseISO(shift.date), 'eee, dd/MM', { locale: vi }) : '';

        return (
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <UserAvatar user={user} size="h-9 w-9 sm:h-10 sm:w-10" />
                <div className="min-w-0">
                    <p className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
                    <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 break-words whitespace-normal tracking-tight leading-tight" title={user?.displayName || "Chưa có"}>
                        {user?.displayName || "Trống"}
                    </p>
                    {shift && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                            <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 leading-tight">{shiftInfoText}</span>
                            <Badge variant="outline" className="h-4 px-1 text-[8px] sm:text-[9px] font-black border-slate-200 dark:border-slate-800 text-slate-500 uppercase rounded-sm shrink-0">
                                {dateText}
                            </Badge>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // --- Action Button Logic ---
    const isMyRequest = payload.requestingUser.userId === currentUser.uid;
    const isDirectRequestToMe = status === 'pending' && payload.targetUserId === currentUser.uid;

    const renderActions = () => {
        if (isDirectRequestToMe) {
            return (
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" onClick={() => onDecline(notification)} disabled={isProcessing} className="flex-1">
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                        Từ chối
                    </Button>
                    <Button size="sm" onClick={() => onAccept(notification)} disabled={isProcessing} className="flex-1">
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                        {payload.isSwapRequest ? 'Đồng ý đổi' : 'Nhận ca'}
                    </Button>
                </div>
            );
        }

        if (isManagerOrOwner) {
            if (status === 'pending_approval') {
                const isRequestByManager = allUsers.find(u => u.uid === payload.requestingUser.userId)?.role === 'Quản lý';
                const isTakenByManager = payload.takenBy && allUsers.find(u => u.uid === payload.takenBy.userId)?.role === 'Quản lý';
                const canOwnerApprove = currentUser.role === 'Chủ nhà hàng';
                const canManagerApprove = currentUser.role === 'Quản lý' && !isRequestByManager && !isTakenByManager;

                if (canOwnerApprove || canManagerApprove) {
                    return (
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button variant="destructive" size="sm" onClick={() => onRejectApproval(notification.id)} disabled={isProcessing} className="flex-1">
                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                                Từ chối
                            </Button>
                            <Button size="sm" onClick={() => onApprove(notification)} disabled={isProcessing} className="flex-1">
                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                                Phê duyệt
                            </Button>
                        </div>
                    );
                }
            }
            if (status === 'pending' && currentUser.role === 'Chủ nhà hàng' && (!payload.targetUserId || !payload.isSwapRequest)) {
                return (
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="secondary" size="sm" onClick={() => onAssign(notification)} disabled={isProcessing} className="flex-1"><UserCheck className="mr-2 h-4 w-4" />Chỉ định</Button>
                        <AlertDialog parentDialogTag="root">
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" disabled={isProcessing} className="flex-1">
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                    Hủy
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hủy yêu cầu?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Không</AlertDialogCancel><AlertDialogAction onClick={() => onCancel(notification.id)}>Xác nhận Hủy</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                    </div>
                );
            }
        }

        if (status === 'pending' && !isMyRequest) {
            const isManagerViewing = currentUser.role === 'Quản lý' || currentUser.role === 'Chủ nhà hàng';

            // A manager can only 'take' a public request, not a direct swap/pass between others.
            if (isManagerViewing && !payload.targetUserId && !payload.isSwapRequest && payload.requestingUser.userId !== currentUser.uid) {
                return (
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button size="sm" onClick={() => onAccept(notification)} disabled={isProcessing} className="flex-1">
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            Nhận ca
                        </Button>
                    </div>
                )
            } else if (!payload.targetUserId) { // Public request for regular staff
                return (
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" size="sm" onClick={() => onDecline(notification)} disabled={isProcessing} className="flex-1">
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                            Bỏ qua
                        </Button>
                        <Button size="sm" onClick={() => onAccept(notification)} disabled={isProcessing} className="flex-1">
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            Nhận ca
                        </Button>
                    </div>
                )
            }
        }

        if (status === 'pending' && isMyRequest) {
            return (
                <Button variant="outline" size="sm" onClick={() => onCancel(notification.id)} disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Hủy yêu cầu
                </Button>
            );
        }

        if (isManagerOrOwner) {
            if (status === 'resolved' && currentUser.role === 'Chủ nhà hàng') {
                return (
                    <div className="flex gap-2 w-full sm:w-auto">
                        <AlertDialog parentDialogTag="root">
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" disabled={isProcessing}>
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo className="mr-2 h-4 w-4" />}
                                    Hoàn tác
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hoàn tác yêu cầu?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Không</AlertDialogCancel><AlertDialogAction onClick={() => onRevert(notification)}>Xác nhận</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog parentDialogTag="root">
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive h-9 w-9"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Xóa khỏi lịch sử?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => onDeleteHistory(notification.id)}>Xóa</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                    </div>
                );
            }
            if (status === 'cancelled' && currentUser.role === 'Chủ nhà hàng') {
                return (
                    <AlertDialog parentDialogTag="root">
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive h-9 w-9"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Xóa khỏi lịch sử?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => onDeleteHistory(notification.id)}>Xóa</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                    </AlertDialog>
                );
            }
        }

        return null;
    }

    const actions = renderActions();

    return (
        <Card className={cn("overflow-hidden border-none shadow-none bg-slate-100/40 dark:bg-slate-900/40 rounded-[28px] sm:rounded-[32px] transition-all", statusConfig.cardBorder)}>
            <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                        <Badge className={cn("h-6 px-2.5 rounded-full border-none font-black text-[9px] sm:text-[10px] tracking-tight uppercase", typeConfig.className)}>
                            <TypeIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1.5" />
                            {typeConfig.text}
                        </Badge>
                        <div className={cn("flex items-center gap-1.5 h-6 px-2.5 rounded-full font-black text-[9px] sm:text-[10px] tracking-tight uppercase", statusConfig.className)}>
                            <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", statusConfig.dot)} />
                            {statusConfig.text}
                        </div>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{metadataText}</span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6 bg-white dark:bg-slate-950 p-3.5 sm:p-4 rounded-[20px] sm:rounded-[24px] border border-slate-100 dark:border-slate-800 shadow-sm">
                    <UserBlock user={requester} shift={shiftA} label="Người gửi" />

                    {payload.isSwapRequest && (
                        <div className="hidden sm:flex items-center justify-center">
                            <ChevronsDownUp className="w-5 h-5 text-slate-200 rotate-90" />
                        </div>
                    )}
                    {payload.isSwapRequest && (
                        <div className="flex sm:hidden items-center gap-3">
                            <Separator className="flex-1 bg-slate-100 dark:bg-slate-800" />
                            <ChevronsDownUp className="w-4 h-4 text-slate-300" />
                            <Separator className="flex-1 bg-slate-100 dark:bg-slate-800" />
                        </div>
                    )}

                    {payload.isSwapRequest ? (
                        <UserBlock user={recipient} shift={shiftB} label="Đổi với" />
                    ) : recipient ? (
                        <UserBlock user={recipient} shift={null} label="Người nhận" />
                    ) : (
                        <div className="flex items-start gap-2.5 flex-1 min-w-0 opacity-50">
                            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800">
                                <Users className="w-4 h-4 text-slate-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Công khai</p>
                                <p className="text-xs sm:text-sm font-black text-slate-500 dark:text-slate-400 truncate tracking-tight">Mọi người</p>
                            </div>
                        </div>
                    )}
                </div>

                {renderActions() && (
                    <div className="mt-4 flex flex-wrap justify-end gap-2 px-1">
                        {renderActions()}
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
    const { toast } = useToast();

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
            toast({
                title: "Thành công",
                description: "Đã xóa yêu cầu khỏi lịch sử."
            });
        } catch (error) {
            toast({
                title: "Lỗi",
                description: "Không thể xóa yêu cầu.",
                variant: "destructive"
            });
        }
    }

    if (!currentUser) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose} dialogTag="pass-requests-dialog" parentDialogTag={parentDialogTag}>
            <DialogContent className="w-[94vw] sm:max-w-2xl h-[90vh] sm:h-[85vh] flex flex-col p-0 overflow-hidden rounded-[38px] sm:rounded-[40px] border-none shadow-3xl bg-white dark:bg-slate-950">
                <div className="p-5 sm:p-6 pb-2">
                    <DialogHeader className="space-y-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="h-12 w-12 sm:h-14 sm:w-14 bg-indigo-500/10 rounded-[18px] sm:rounded-[20px] flex items-center justify-center shrink-0">
                                <Send className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-500" />
                            </div>
                            <div className="min-w-0">
                                <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
                                    Quản lý Pass ca
                                </DialogTitle>
                                <DialogDescription className="text-[12px] sm:text-sm font-bold text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wide">
                                    Tuần từ {format(weekInterval.start, 'dd/MM')} đến {format(weekInterval.end, 'dd/MM/yyyy')}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                </div>

                <Tabs defaultValue="pending" className="flex-grow flex flex-col overflow-hidden">
                    <div className="px-5 sm:px-6">
                        <TabsList className="flex w-full h-11 sm:h-12 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-[18px] sm:rounded-[20px] gap-1">
                            <TabsTrigger
                                value="pending"
                                className="flex-1 rounded-[13px] sm:rounded-[14px] text-[10px] sm:text-xs font-black tracking-tight data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:text-indigo-500 px-1"
                            >
                                Đang chờ
                                {pendingRequests.length > 0 && <Badge className="ml-1.5 sm:ml-2 h-4.5 px-1.5 rounded-md bg-indigo-500 text-white border-none font-black text-[9px]">{pendingRequests.length}</Badge>}
                            </TabsTrigger>
                            <TabsTrigger
                                value="history"
                                className="flex-1 rounded-[13px] sm:rounded-[14px] text-[10px] sm:text-xs font-black tracking-tight data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:shadow-sm data-[state=active]:text-slate-500 px-1"
                            >
                                Lịch sử
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <ScrollArea className="flex-grow">
                        <TabsContent value="pending" className="m-0 p-5 sm:p-6 pt-4 space-y-4">
                            {pendingRequests.length > 0 ? (
                                <div className="space-y-4 pb-6">
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
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="h-16 w-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                                        <CheckCircle className="h-8 w-8 text-green-500" />
                                    </div>
                                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">Đã sạch bóng yêu cầu!</p>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Không có gì cần xử lý lúc này</p>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="history" className="m-0 p-5 sm:p-6 pt-4 space-y-4">
                            {historicalRequests.length > 0 ? (
                                <div className="space-y-4 pb-10">
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
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-center">
                                    <div className="h-16 w-16 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-4">
                                        <Info className="h-8 w-8 text-slate-300 dark:text-slate-700" />
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Lịch sử trống</p>
                                </div>
                            )}
                        </TabsContent>
                    </ScrollArea>
                </Tabs>

                <div className="p-5 sm:p-6 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <Button variant="ghost" className="w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all text-[11px] sm:text-xs uppercase tracking-widest" onClick={onClose}>
                        ĐÓNG
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
