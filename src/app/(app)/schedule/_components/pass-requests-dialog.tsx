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
import { ArrowRight, AlertCircle, CheckCircle, XCircle, Undo, Info, UserCheck, Trash2, Calendar, Clock, User as UserIcon, Send, Loader2, UserCog, Replace, ChevronsDownUp, MailQuestion, FileUp } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


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
    const { toast } = useToast();
    const isManagerOrOwner = currentUser.role === 'Quản lý' || currentUser.role === 'Chủ nhà hàng';
    const isProcessing = processingNotificationId === notification.id;


    // --- Status and Type Configuration ---
    const getStatusConfig = () => {
        switch (status) {
            case 'pending': return { text: 'Đang chờ', icon: MailQuestion, className: 'bg-yellow-500 text-white', cardBorder: 'border-yellow-500' };
            case 'pending_approval': return { text: 'Chờ duyệt', icon: AlertCircle, className: 'bg-amber-500 text-white', cardBorder: 'border-amber-500' };
            case 'resolved': return { text: 'Đã giải quyết', icon: CheckCircle, className: 'bg-green-600 text-green-50', cardBorder: 'border-green-600' };
            case 'cancelled': return { text: 'Đã huỷ', icon: XCircle, className: 'bg-red-600 text-red-50', cardBorder: 'border-red-500' };
            default: return { text: 'Không rõ', icon: Info, className: 'bg-gray-500 text-white', cardBorder: 'border-gray-500' };
        }
    };
    
    const getTypeConfig = () => {
        if (payload.isSwapRequest) return { text: 'ĐỔI CA', Icon: Replace, className: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700' };
        if (payload.targetUserId) return { text: 'NHỜ NHẬN', Icon: Send, className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700' };
        return { text: 'PASS CÔNG KHAI', Icon: MailQuestion, className: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-500' };
    };

    const statusConfig = getStatusConfig();
    const typeConfig = getTypeConfig();
    const StatusIcon = statusConfig.icon;
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

        const sA = {
            label: payload.shiftLabel,
            timeSlot: payload.shiftTimeSlot,
            date: payload.shiftDate,
        };
        
        let sB: { label: string, timeSlot: { start: string, end: string }, date: string } | null = null;
        if (payload.isSwapRequest && payload.targetUserShiftPayload) {
            sB = {
                label: payload.targetUserShiftPayload.shiftLabel,
                timeSlot: payload.targetUserShiftPayload.shiftTimeSlot,
                date: payload.targetUserShiftPayload.date,
            };
        }
        
        return { requester: reqUser, recipient: recUser, shiftA: sA, shiftB: sB };
    }, [payload, allUsers, status]);

    const metadataText = useMemo(() => {
        if (status === 'resolved' && resolvedBy && resolvedAt) {
            return `Giải quyết bởi ${resolvedBy.userName} lúc ${format(parseISO(resolvedAt), 'HH:mm')}`;
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
     const UserBlock = ({ user, shift, label }: { user?: ManagedUser, shift?: { label: string, timeSlot: { start: string, end: string }, date: string } | null, label: string }) => {
        if (!user) {
            return (
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">?</div>
                    <div className="min-w-0">
                        <div className="text-sm font-semibold truncate text-muted-foreground">{label}</div>
                        <div className="text-xs text-muted-foreground truncate">Chưa có người nhận</div>
                    </div>
                </div>
            )
        };
        const initials = user.displayName.split(' ').map(n => n[0]).join('').substring(0, 2);
        const shiftInfoText = shift ? `${shift.label} • ${shift.timeSlot.start}-${shift.timeSlot.end} • ${format(parseISO(shift.date), 'eee, dd/MM', { locale: vi })}` : 'Không có ca';
        
        return (
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0" title={user.displayName}>{initials}</div>
                <div className="min-w-0">
                    <div className="text-sm font-semibold truncate" title={user.displayName}>{user.displayName}</div>
                    <div className="text-xs text-muted-foreground" title={shiftInfoText}>{shiftInfoText}</div>
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
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4"/>}
                        Từ chối
                    </Button>
                    <Button size="sm" onClick={() => onAccept(notification)} disabled={isProcessing} className="flex-1">
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
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

                if(canOwnerApprove || canManagerApprove) {
                     return (
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button variant="destructive" size="sm" onClick={() => onRejectApproval(notification.id)} disabled={isProcessing} className="flex-1">
                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4"/>}
                                Từ chối
                            </Button>
                            <Button size="sm" onClick={() => onApprove(notification)} disabled={isProcessing} className="flex-1">
                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                                Phê duyệt
                            </Button>
                        </div>
                    );
                }
            }
             if (status === 'pending' && currentUser.role === 'Chủ nhà hàng' && (!payload.targetUserId || !payload.isSwapRequest)) {
                 return (
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="secondary" size="sm" onClick={() => onAssign(notification)} disabled={isProcessing} className="flex-1"><UserCheck className="mr-2 h-4 w-4"/>Chỉ định</Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" disabled={isProcessing} className="flex-1">
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
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
            if(isManagerViewing && !payload.targetUserId && !payload.isSwapRequest && payload.requestingUser.userId !== currentUser.uid) {
                return (
                     <div className="flex gap-2 w-full sm:w-auto">
                        <Button size="sm" onClick={() => onAccept(notification)} disabled={isProcessing} className="flex-1">
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                            Nhận ca
                        </Button>
                    </div>
                )
            } else if (!payload.targetUserId) { // Public request for regular staff
                return (
                     <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="outline" size="sm" onClick={() => onDecline(notification)} disabled={isProcessing} className="flex-1">
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4"/>}
                            Bỏ qua
                        </Button>
                        <Button size="sm" onClick={() => onAccept(notification)} disabled={isProcessing} className="flex-1">
                            {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
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

        if(isManagerOrOwner) {
             if (status === 'resolved' && currentUser.role === 'Chủ nhà hàng') {
                return (
                    <div className="flex gap-2 w-full sm:w-auto">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" disabled={isProcessing}>
                                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Undo className="mr-2 h-4 w-4"/>}
                                    Hoàn tác
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hoàn tác yêu cầu?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Không</AlertDialogCancel><AlertDialogAction onClick={() => onRevert(notification)}>Xác nhận</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                         <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive h-9 w-9"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Xóa khỏi lịch sử?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => onDeleteHistory(notification.id)}>Xóa</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                    </div>
                );
            }
            if (status === 'cancelled' && currentUser.role === 'Chủ nhà hàng') {
                return (
                     <AlertDialog>
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
       <Card className={cn("rounded-lg shadow-md border-2", statusConfig.cardBorder)}>
            <div className="flex items-start justify-between p-3">
                 <div className="flex items-center gap-2">
                  <Badge variant="outline" className={typeConfig.className}>
                    <TypeIcon className="mr-1 h-3 w-3" />
                    {typeConfig.text}
                  </Badge>
                  <Badge variant="outline" className={cn('text-xs', statusConfig.className)}>
                    <StatusIcon className="mr-1 h-3 w-3" />
                    {statusConfig.text}
                  </Badge>
                </div>
                 <div className="text-xs text-muted-foreground text-right shrink-0">
                  {format(parseISO(createdAt as string), 'HH:mm · dd/MM')}
                </div>
            </div>

            <Separator />
            
             <div className="p-3">
                <div className="flex flex-col md:flex-row gap-3 items-center">
                    <UserBlock user={requester} shift={shiftA} label="Người yêu cầu" />
                    {payload.isSwapRequest 
                        ? <Replace className="h-6 w-6 text-muted-foreground mx-auto my-2 md:my-auto transform md:rotate-0 rotate-90" /> 
                        : <ArrowRight className="h-6 w-6 text-muted-foreground mx-auto my-2 md:my-auto" />
                    }
                    <UserBlock user={recipient} shift={shiftB} label={payload.isSwapRequest ? "Muốn đổi với" : "Người nhận"} />
                </div>
                <div className="px-1 pt-2 text-xs text-muted-foreground flex items-center justify-between">
                    <div className="whitespace-pre-wrap" title={metadataText}>{metadataText}</div>
                    {/* Placeholder for future attachments */}
                </div>
            </div>


            {actions && (
                <>
                <Separator />
                <div className={cn("p-3 flex flex-col md:flex-row md:justify-end gap-2", isProcessing && "opacity-70 pointer-events-none")}>
                    {actions}
                </div>
                </>
            )}
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

    pending.sort((a,b) => {
        const dateA = new Date(`${a.payload.shiftDate}T${a.payload.shiftTimeSlot.start}`);
        const dateB = new Date(`${b.payload.shiftDate}T${b.payload.shiftTimeSlot.end}`);
        return dateA.getTime() - dateB.getTime();
    });

    historical.sort((a,b) => {
        const timeA = a.resolvedAt || a.createdAt;
        const timeB = b.resolvedAt || b.createdAt;
        return new Date(timeB as string).getTime() - new Date(timeA as string).getTime();
    });

    return { pendingRequests: pending, historicalRequests: historical };
  }, [notifications, currentUser, allUsers, weekInterval, isManagerOrOwner]);
  
  const handleDeleteFromHistory = async (notificationId: string) => {
    if (currentUser?.role !== 'Chủ nhà hàng') return;
    try {
        await dataStore.deleteNotification(notificationId);
        toast({
            title: "Thành công",
            description: "Đã xóa yêu cầu khỏi lịch sử."
        });
    } catch(error) {
        toast({
            title: "Lỗi",
            description: "Không thể xóa yêu cầu.",
            variant: "destructive"
        });
    }
  }

  if (!currentUser) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-full md:h-[90vh] flex flex-col p-0 bg-white dark:bg-card rounded-xl shadow-lg">
        <DialogHeader className="p-4 sm:p-6 pb-2 border-b">
          <DialogTitle>Quản lý Yêu cầu Pass ca</DialogTitle>
          <DialogDescription>
            Tuần từ {format(weekInterval.start, 'dd/MM')} đến {format(weekInterval.end, 'dd/MM/yyyy')}.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="pending" className="flex-grow flex flex-col overflow-hidden px-4 sm:px-6">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="pending">
                    Đang chờ xử lý
                    {pendingRequests.length > 0 && <Badge variant="destructive" className="ml-2">{pendingRequests.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="history">Lịch sử</TabsTrigger>
            </TabsList>
            
            <TabsContent value="pending" className="flex-grow overflow-auto pt-4">
                 {pendingRequests.length > 0 ? (
                    <div className="space-y-4">
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
                    <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-4">
                        <CheckCircle className="h-12 w-12 text-green-500"/>
                        <p>Không có yêu cầu nào đang chờ xử lý.</p>
                    </div>
                 )}
            </TabsContent>
            
            <TabsContent value="history" className="flex-grow overflow-auto pt-4">
                 {historicalRequests.length > 0 ? (
                    <div className="space-y-4">
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
                    <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-4">
                        <Info className="h-12 w-12"/>
                        <p>Chưa có yêu cầu nào trong lịch sử.</p>
                    </div>
                 )}
            </TabsContent>

        </Tabs>
        <DialogFooter className="p-4 sm:p-6 border-t">
            <Button variant="outline" onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
