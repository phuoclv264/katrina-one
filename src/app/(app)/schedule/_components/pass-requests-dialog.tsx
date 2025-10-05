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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { Schedule, ManagedUser, Notification, PassRequestPayload, AuthUser, UserRole, AssignedUser } from '@/lib/types';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { AlertCircle, CheckCircle, XCircle, Undo, Info, UserCheck, Trash2, Calendar, Clock, User as UserIcon, Send, Loader2, UserCog, Replace } from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import { dataStore } from '@/lib/data-store';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { isUserAvailable } from '@/lib/schedule-utils';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const ManagerReviewContent = ({ notification, schedule }: { notification: Notification, schedule: Schedule | null }) => {
    const { payload } = notification;

    // Detailed Pass Request
    if (!payload.isSwapRequest && payload.takenBy) {
        return (
            <div className="text-left space-y-2 py-2">
                 <p className="font-bold text-lg text-primary text-center">YÊU CẦU PASS CA</p>
                <div className="text-sm border p-3 rounded-md bg-background">
                    <p><span className="font-semibold">{payload.requestingUser.userName}</span> muốn pass ca:</p>
                    <p className="font-semibold text-primary">{payload.shiftLabel} ({payload.shiftTimeSlot.start} - {payload.shiftTimeSlot.end})</p>
                    <p className="text-muted-foreground">{format(parseISO(payload.shiftDate), 'eeee, dd/MM/yyyy', { locale: vi })}</p>
                </div>
                 <div className="text-sm border p-3 rounded-md bg-background">
                    <p><span className="font-semibold">{payload.takenBy.userName}</span> đã nhận ca này.</p>
                </div>
            </div>
        );
    }

    // Swap Request
    if (payload.isSwapRequest) {
        const swapForShift = schedule?.shifts.find(s =>
            s.date === payload.shiftDate &&
            s.assignedUsers.some(u => u.userId === payload.takenBy?.userId)
        );

        return (
            <div className="text-center space-y-2 py-2">
                <p className="font-bold text-lg text-primary">YÊU CẦU ĐỔI CA</p>
                <p className="text-sm text-muted-foreground -mt-2">({format(parseISO(payload.shiftDate), 'eeee, dd/MM/yyyy', { locale: vi })})</p>
                <div className="text-sm border p-3 rounded-md bg-background">
                    <p className="font-semibold">{payload.requestingUser.userName}</p>
                    <p className="text-muted-foreground">{payload.shiftLabel} ({payload.shiftTimeSlot.start} - {payload.shiftTimeSlot.end})</p>
                </div>
                <Replace className="h-5 w-5 text-muted-foreground mx-auto" />
                <div className="text-sm border p-3 rounded-md bg-background">
                    <p className="font-semibold">{payload.takenBy?.userName}</p>
                    {swapForShift ? (
                         <p className="text-muted-foreground">{swapForShift.label} ({swapForShift.timeSlot.start} - {swapForShift.timeSlot.end})</p>
                    ) : (
                        <p className="text-sm text-red-500">Lỗi: không tìm thấy ca để đổi</p>
                    )}
                </div>
            </div>
        );
    }

    // Fallback for simple pass request review (should not be commonly hit for manager review)
    return (
        <p className="flex items-center gap-2 font-medium text-amber-600">
            <Send />
            {payload.requestingUser.userName} pass ca, được nhận bởi {payload.takenBy?.userName}
        </p>
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
    onAssign?: (notification: Notification) => void; // Made optional for staff view
    onApprove: (notification: Notification) => void;
    onRejectApproval: (notificationId: string) => void;
    isProcessing: boolean;
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
  onAssign = () => {}, // No-op for staff view
  onApprove,
  onRejectApproval,
  isProcessing,
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

      if (notification.status === 'pending' || notification.status === 'pending_approval') {
        const isRequestInvolvingManager = allUsers.find(u => u.uid === payload.requestingUser.userId)?.role === 'Quản lý' || (payload.takenBy && allUsers.find(u => u.uid === payload.takenBy?.userId)?.role === 'Quản lý');

        // Always show direct requests to the current user first, regardless of role.
        if (notification.status === 'pending' && payload.targetUserId === currentUser.uid) {
            pending.push(notification);
            return;
        }

        // Manager/Owner specific logic
        if (isManagerOrOwner) {
            if (currentUser.role === 'Chủ nhà hàng' || !isRequestInvolvingManager) {
                pending.push(notification);
                return;
            }
        }
        
        // Staff logic (or manager acting as staff for non-manager requests)
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
      } else { // 'resolved' or 'cancelled'
        if(isMyRequest || didITakeTheShift || isManagerOrOwner) {
            historical.push(notification);
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

  const renderRequestActions = (notification: Notification) => {
    const payload = notification.payload;
    const isMyRequest = payload.requestingUser.userId === currentUser!.uid;
    const isSwap = payload.isSwapRequest;
    
    const isDirectRequestToMe = notification.status === 'pending' && payload.targetUserId === currentUser!.uid;
    const isManagerReviewing = isManagerOrOwner && notification.status === 'pending_approval';

    // Priority 1: Handle direct requests to the current user (even if they are a manager)
    if (isDirectRequestToMe) {
      return (
        <div className="flex gap-2 self-end sm:self-center">
          <Button variant="outline" size="sm" onClick={() => onDecline(notification)} disabled={isProcessing}><XCircle className="mr-2 h-4 w-4"/>Từ chối</Button>
          <Button size="sm" onClick={() => onAccept(notification)} disabled={isProcessing}>
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : (isSwap ? <Replace className="mr-2 h-4 w-4"/> : <CheckCircle className="mr-2 h-4 w-4"/>)}
              {isSwap ? 'Đổi ca' : 'Nhận ca'}
          </Button>
        </div>
      );
    }
    
    // Priority 2: Handle manager's approval actions
    if (isManagerReviewing) {
        const canOwnerApprove = currentUser!.role === 'Chủ nhà hàng';
        const isRequestInvolvingManager = allUsers.find(u => u.uid === payload.requestingUser.userId)?.role === 'Quản lý' || (payload.takenBy && allUsers.find(u => u.uid === payload.takenBy?.userId)?.role === 'Quản lý');
        const canManagerApprove = currentUser!.role === 'Quản lý' && !isRequestInvolvingManager;

        if (canOwnerApprove || canManagerApprove) {
            return (
                <div className="flex gap-2 self-end sm:self-center">
                    <Button variant="destructive" size="sm" onClick={() => onRejectApproval(notification.id)} disabled={isProcessing}>
                        <XCircle className="mr-2 h-4 w-4"/> Từ chối
                    </Button>
                    <Button size="sm" onClick={() => onApprove(notification)} disabled={isProcessing}>
                        <CheckCircle className="mr-2 h-4 w-4"/> Phê duyệt
                    </Button>
                </div>
            );
        }
    }

    // Priority 3: Handle manager's actions on pending public requests
    if (isManagerOrOwner && notification.status === 'pending') {
        const isDirectRequest = !!payload.targetUserId;
        return (
            <div className="flex gap-2 self-end sm:self-center">
                 {!isDirectRequest && (
                    <Button variant="secondary" size="sm" onClick={() => onAssign(notification)} disabled={isProcessing}>
                        <UserCheck className="mr-2 h-4 w-4"/> Chỉ định
                    </Button>
                 )}
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={isProcessing}><Trash2 className="mr-2 h-4 w-4"/> Hủy</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Hủy yêu cầu pass ca?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ hủy yêu cầu của {payload.requestingUser.userName}.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Không</AlertDialogCancel><AlertDialogAction onClick={() => onCancel(notification.id)}>Xác nhận Hủy</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        );
    }

    // Priority 4: Manager actions on historical requests
    if (isManagerOrOwner && (notification.status === 'resolved' || notification.status === 'cancelled')) {
        return (
            <div className="flex gap-2 self-end sm:self-center">
                {notification.status === 'resolved' && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" disabled={isProcessing}><Undo className="mr-2 h-4 w-4"/>Hoàn tác</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Hoàn tác yêu cầu?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ gán lại ca cho nhân viên ban đầu ({payload.requestingUser.userName}).</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Không</AlertDialogCancel><AlertDialogAction onClick={() => onRevert(notification)}>Xác nhận</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
                {currentUser!.role === 'Chủ nhà hàng' && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive h-9 w-9"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Xóa khỏi lịch sử?</AlertDialogTitle><AlertDialogDescription>Hành động này không thể hoàn tác.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteFromHistory(notification.id)}>Xóa vĩnh viễn</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>
        );
    }

    // Default Staff Actions
    if (isMyRequest) {
        if (notification.status === 'pending') return <Button variant="outline" size="sm" onClick={() => onCancel(notification.id)} disabled={isProcessing}>Hủy yêu cầu</Button>;
        if (notification.status === 'pending_approval') return <Badge variant="secondary" className="p-2">Chờ duyệt</Badge>;
    } else {
        if (notification.status === 'pending') {
            return (
                <div className="flex gap-2 self-end sm:self-center">
                    <Button variant="outline" size="sm" onClick={() => onDecline(notification)} disabled={isProcessing}><XCircle className="mr-2 h-4 w-4"/>Từ chối</Button>
                    <Button size="sm" onClick={() => onAccept(notification)} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : (isSwap ? <Replace className="mr-2 h-4 w-4" /> : <CheckCircle className="mr-2 h-4 w-4"/>)}
                        {isSwap ? 'Đổi ca' : 'Nhận ca'}
                    </Button>
                </div>
            );
        }
        if (notification.status === 'pending_approval' && payload.takenBy?.userId === currentUser!.uid) {
            return <Badge variant="secondary" className="p-2">Chờ duyệt</Badge>;
        }
    }
    
    return null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quản lý Yêu cầu Pass ca</DialogTitle>
          <DialogDescription>
            Các yêu cầu cho tuần từ {format(weekInterval.start, 'dd/MM')} đến {format(weekInterval.end, 'dd/MM/yyyy')}.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
            <div className="space-y-6">
                <div>
                    <h3 className="font-semibold mb-2">Yêu cầu đang chờ xử lý</h3>
                    {pendingRequests.length > 0 ? (
                        <div className="space-y-3">
                        {pendingRequests.map(notification => {
                            const payload = notification.payload;
                            const isMyRequest = payload.requestingUser.userId === currentUser!.uid;
                            const targetUser = payload.targetUserId ? allUsers.find(u => u.uid === payload.targetUserId) : null;
                            const isManagerReviewing = isManagerOrOwner && notification.status === 'pending_approval';

                             let myCurrentShiftLabel = "Không có";
                             if (schedule && !isManagerOrOwner && payload.isSwapRequest) {
                                myCurrentShiftLabel = schedule.shifts
                                    .filter(s => s.date === payload.shiftDate && s.assignedUsers.some(u => u.userId === currentUser!.uid))
                                    .map(s => `${s.label} (${s.timeSlot.start}-${s.timeSlot.end})`)
                                    .join(', ') || 'Không có';
                            }
                             
                            const isManagerViewingPendingSwap = isManagerOrOwner && !isMyRequest && payload.isSwapRequest && payload.targetUserId && notification.status === 'pending';

                            return (
                                <Card key={notification.id} className={notification.status === 'pending_approval' ? "border-amber-500 border-2" : "border-primary border-2"}>
                                    <CardContent className="p-3 flex flex-col sm:flex-row justify-between gap-3">
                                        <div className="space-y-2">
                                           {isManagerReviewing ? (
                                                <ManagerReviewContent notification={notification} schedule={schedule} />
                                            ) : (
                                                <>
                                                    <p className="font-bold text-lg">{payload.shiftLabel}</p>
                                                    <div className="text-sm text-muted-foreground space-y-1">
                                                        <p className="flex items-center gap-2"><Clock />{payload.shiftTimeSlot.start} - {payload.shiftTimeSlot.end}</p>
                                                        <p className="flex items-center gap-2"><Calendar />{format(new Date(payload.shiftDate), 'eeee, dd/MM/yyyy', { locale: vi })}</p>
                                                        
                                                        {isMyRequest ? (
                                                            targetUser ? (
                                                                <p className="flex items-center gap-2 font-medium text-blue-600"><Send />
                                                                    {payload.isSwapRequest ? 'Đã gửi yêu cầu ĐỔI CA tới:' : 'Đã gửi yêu cầu PASS CA tới:'} {targetUser.displayName}
                                                                </p>
                                                            ) : (
                                                                <p className="flex items-center gap-2 font-medium text-foreground"><UserIcon />Yêu cầu công khai của bạn</p>
                                                            )
                                                        ) : (
                                                            <>
                                                                <p className="flex items-center gap-2 font-medium text-foreground"><UserIcon />Từ {payload.requestingUser.userName}</p>
                                                                {(isManagerViewingPendingSwap || (payload.targetUserId === currentUser!.uid)) && (
                                                                    <p className="flex items-center gap-2 font-medium text-blue-600"><Send />
                                                                        {payload.isSwapRequest ? `Yêu cầu ĐỔI CA ${isManagerViewingPendingSwap ? `tới: ${targetUser?.displayName || 'Không rõ'}` : 'với bạn.'}` : 'Yêu cầu PASS CA trực tiếp cho bạn.'}
                                                                    </p>
                                                                )}

                                                                {payload.isSwapRequest && !isManagerOrOwner && <p className="font-semibold text-primary">Ca của bạn: {myCurrentShiftLabel}</p>}
                                                            </>
                                                        )}
                                                        
                                                        {notification.status === 'pending_approval' && payload.takenBy &&
                                                            <p className="flex items-center gap-2 font-medium text-amber-600"><Send />Được nhận bởi: {payload.takenBy.userName}</p>
                                                        }
                                                    </div>
                                                </>
                                           )}
                                        </div>
                                        <div className="flex items-end">
                                            {renderRequestActions(notification)}
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground text-left py-4 flex items-center gap-2"><Info className="h-4 w-4"/><span>Không có yêu cầu nào đang chờ.</span></div>
                    )}
                </div>
                <div>
                    <h3 className="font-semibold mb-2">Lịch sử yêu cầu</h3>
                    {historicalRequests.length > 0 ? (
                        <div className="space-y-3">
                        {historicalRequests.map(notification => {
                            const payload = notification.payload;
                            const timeToShow = (notification.resolvedAt || notification.createdAt) as string;
                            
                            const isSwap = payload.isSwapRequest && notification.status === 'resolved' && payload.takenBy;
                            let swapForShiftLabel: string | null = null;
                            if (isSwap) {
                                const swapShift = schedule?.shifts.find(s => s.date === payload.shiftDate && s.assignedUsers.some(u => u.userId === payload.requestingUser.userId));
                                if (swapShift) {
                                     swapForShiftLabel = `${swapShift.label} (${swapShift.timeSlot.start}-${swapShift.timeSlot.end})`;
                                }
                            }

                            return (
                                <Card key={notification.id}>
                                    <CardContent className="p-3 flex flex-col sm:flex-row justify-between gap-3">
                                        <div className="space-y-2">
                                            {isSwap ? (
                                                 <div className="text-sm space-y-1">
                                                     <div className="flex items-center gap-2">
                                                        <span className="font-semibold">{payload.requestingUser.userName}</span>
                                                        <span className="text-muted-foreground">({payload.shiftLabel})</span>
                                                     </div>
                                                    <div className="flex items-center gap-2 pl-2">
                                                        <Replace className="h-4 w-4 text-muted-foreground"/>
                                                        <span>đổi với</span>
                                                    </div>
                                                     <div className="flex items-center gap-2">
                                                        <span className="font-semibold">{payload.takenBy!.userName}</span>
                                                        <span className="text-muted-foreground">({swapForShiftLabel || 'ca đã đổi'})</span>
                                                     </div>
                                                 </div>
                                            ) : (
                                                 <p className="font-medium">{payload.shiftLabel} <span className="text-sm text-muted-foreground">({payload.shiftTimeSlot.start} - {payload.shiftTimeSlot.end})</span></p>
                                            )}
                                            
                                            <div className="text-sm text-muted-foreground space-y-1">
                                                 {!isSwap && <p className="flex items-center gap-2"><UserIcon />{payload.requestingUser.userName} - {format(new Date(payload.shiftDate), 'dd/MM', { locale: vi })}</p>}
                                                 {notification.resolvedBy && (<p className="flex items-center gap-2"><UserCog className="h-4 w-4"/><span>Xử lý bởi: {notification.resolvedBy.userName}</span></p>)}
                                            </div>

                                            {notification.status === 'resolved' && payload.takenBy && !isSwap && (<Badge className="mt-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Đã nhận bởi {payload.takenBy.userName}</Badge>)}
                                            {notification.status === 'cancelled' && (<div className="flex flex-col items-start gap-1 mt-1"><Badge variant="destructive">Đã hủy lúc {format(new Date(timeToShow), "HH:mm")}</Badge>{payload.cancellationReason && (<p className="text-xs italic text-destructive">{payload.cancellationReason}</p>)}</div>)}
                                        </div>
                                        <div className="flex items-end">
                                            {renderRequestActions(notification)}
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                        </div>
                    ) : (
                         <div className="text-sm text-muted-foreground text-left py-4 flex items-center gap-2"><AlertCircle className="h-4 w-4"/><span>Không có lịch sử yêu cầu nào.</span></div>
                    )}
                </div>
            </div>
        </ScrollArea>
        <DialogFooter>
            <Button variant="outline" onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
