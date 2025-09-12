
'use client';
import React, { useMemo, useEffect, useState } from 'react';
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
import type { Schedule, ManagedUser, Notification, PassRequestPayload, AuthUser } from '@/lib/types';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { AlertCircle, CheckCircle, XCircle, Undo, Info, UserCheck, Trash2 } from 'lucide-react';
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

type PassRequestsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  currentUser: AuthUser;
  allUsers: ManagedUser[];
  weekInterval: { start: Date; end: Date };
  onAccept: (notification: Notification) => void;
  onDecline: (notification: Notification) => void;
  onCancel: (notificationId: string) => void;
  onRevert: (notification: Notification) => void;
  onAssign: (notification: Notification) => void;
};

export default function PassRequestsDialog({
  isOpen,
  onClose,
  notifications,
  currentUser,
  allUsers,
  weekInterval,
  onAccept,
  onDecline,
  onCancel,
  onRevert,
  onAssign,
}: PassRequestsDialogProps) {
  
  const canManage = currentUser.role === 'Quản lý' || currentUser.role === 'Chủ nhà hàng';

  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null);
  const [showRevertConfirm, setShowRevertConfirm] = useState<Notification | null>(null);

  // --- Back button handling ---
  useEffect(() => {
    const dialogIsOpen = isOpen || !!showCancelConfirm || !!showRevertConfirm;
    const handler = (e: PopStateEvent) => {
      if (dialogIsOpen) {
        e.preventDefault();
        setShowCancelConfirm(null);
        setShowRevertConfirm(null);
        if (isOpen && !showCancelConfirm && !showRevertConfirm) {
          onClose();
        }
      }
    };

    if (dialogIsOpen) {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handler);
    }

    return () => {
      window.removeEventListener('popstate', handler);
    };
  }, [isOpen, onClose, showCancelConfirm, showRevertConfirm]);


  const { pendingRequests, historicalRequests } = useMemo(() => {
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

      if (notification.status === 'pending') {
         // Show my own pending requests
         if (isMyRequest) {
            pending.push(notification);
            return;
         }
         // For others' requests, check if eligible to see
         const isDifferentRole = payload.shiftRole !== 'Bất kỳ' && currentUser.role !== payload.shiftRole;
         const hasDeclined = (payload.declinedBy || []).includes(currentUser.uid);
         if (!isDifferentRole && !hasDeclined) {
            pending.push(notification);
         }
      } else { // 'resolved' or 'cancelled'
        if(isMyRequest || canManage) {
            historical.push(notification);
        }
      }
    });

    // Sort pending requests by shift time (earliest first)
    pending.sort((a,b) => {
        const dateA = new Date(`${a.payload.shiftDate}T${a.payload.shiftTimeSlot.start}`);
        const dateB = new Date(`${b.payload.shiftDate}T${b.payload.shiftTimeSlot.start}`);
        return dateA.getTime() - dateB.getTime();
    });

    // Sort historical requests by when they were created/resolved (newest first)
    historical.sort((a,b) => {
        const timeA = a.resolvedAt || a.createdAt;
        const timeB = b.resolvedAt || b.createdAt;
        return new Date(timeB as string).getTime() - new Date(timeA as string).getTime();
    });


    return { pendingRequests: pending, historicalRequests: historical };
  }, [notifications, currentUser, canManage, weekInterval]);
  
  const renderRequestActions = (notification: Notification) => {
      if (canManage) {
        if (notification.status === 'pending') {
           return (
            <div className="flex gap-2 self-end sm:self-center">
                 <Button variant="secondary" size="sm" onClick={() => onAssign(notification)}>
                    <UserCheck className="mr-2 h-4 w-4"/> Chỉ định
                </Button>
                <AlertDialog open={showCancelConfirm === notification.id} onOpenChange={(open) => !open && setShowCancelConfirm(null)}>
                    <AlertDialogTrigger asChild>
                         <Button variant="destructive" size="sm" onClick={() => setShowCancelConfirm(notification.id)}>
                            <Trash2 className="mr-2 h-4 w-4"/> Hủy
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                         <AlertDialogHeader><AlertDialogTitle>Hủy yêu cầu pass ca?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ hủy yêu cầu của {notification.payload.requestingUser.userName}. Nhân viên này sẽ tiếp tục chịu trách nhiệm cho ca làm việc.</AlertDialogDescription></AlertDialogHeader>
                         <AlertDialogFooter><AlertDialogCancel>Không</AlertDialogCancel><AlertDialogAction onClick={() => { onCancel(notification.id); setShowCancelConfirm(null); }}>Xác nhận Hủy</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
          );
        }
        if (notification.status === 'resolved') {
           return (
            <div className="flex gap-2 self-end sm:self-center">
                <AlertDialog open={showRevertConfirm?.id === notification.id} onOpenChange={(open) => !open && setShowRevertConfirm(null)}>
                    <AlertDialogTrigger asChild>
                         <Button variant="outline" size="sm" onClick={() => setShowRevertConfirm(notification)}><Undo className="mr-2 h-4 w-4"/>Hoàn tác</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                         <AlertDialogHeader><AlertDialogTitle>Hoàn tác yêu cầu?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ gán ca làm việc trở lại cho nhân viên ban đầu ({notification.payload.requestingUser.userName}) và đặt lại trạng thái yêu cầu này.</AlertDialogDescription></AlertDialogHeader>
                         <AlertDialogFooter><AlertDialogCancel>Không</AlertDialogCancel><AlertDialogAction onClick={() => { onRevert(notification); setShowRevertConfirm(null); }}>Xác nhận Hoàn tác</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
           );
        }
        return null;
      }
      
      // Actions for staff
      const isMyRequest = notification.payload.requestingUser.userId === currentUser.uid;
      if (isMyRequest) {
          if (notification.status === 'pending') {
              return <Button variant="outline" size="sm" onClick={() => onCancel(notification.id)}>Hủy yêu cầu</Button>
          }
      } else { // It's someone else's request
           if (notification.status === 'pending') {
             return (
                 <div className="flex gap-2 self-end sm:self-center">
                    <Button variant="outline" size="sm" onClick={() => onDecline(notification)}><XCircle className="mr-2 h-4 w-4"/>Từ chối</Button>
                    <Button size="sm" onClick={() => onAccept(notification)}><CheckCircle className="mr-2 h-4 w-4"/>Nhận ca</Button>
                </div>
             );
           }
      }
      
      return null;
  }
  
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
                
                 {/* All Pending Requests */}
                <div>
                    <h3 className="font-semibold mb-2">Yêu cầu đang chờ xử lý</h3>
                    {pendingRequests.length > 0 ? (
                        <div className="space-y-3">
                        {pendingRequests.map(notification => {
                            const payload = notification.payload;
                            const isMyRequest = payload.requestingUser.userId === currentUser.uid;
                            return (
                                <div key={notification.id} className="p-3 border rounded-md flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <div className="flex-1">
                                        <p className="font-medium">{payload.shiftLabel} ({payload.shiftTimeSlot.start} - {payload.shiftTimeSlot.end})</p>
                                        <p className="text-sm text-muted-foreground">{isMyRequest ? 'Yêu cầu của bạn' : `Yêu cầu từ ${payload.requestingUser.userName}`} - {format(new Date(payload.shiftDate), 'eeee, dd/MM/yyyy', { locale: vi })}</p>
                                    </div>
                                    {renderRequestActions(notification)}
                                </div>
                            )
                        })}
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground text-left py-4 flex items-center gap-2">
                            <Info className="h-4 w-4"/>
                            <span>Không có yêu cầu nào đang chờ trong tuần này.</span>
                        </div>
                    )}
                </div>

                 {/* Historical Requests */}
                <div>
                    <h3 className="font-semibold mb-2">Lịch sử yêu cầu</h3>
                    {historicalRequests.length > 0 ? (
                        <div className="space-y-3">
                        {historicalRequests.map(notification => {
                            const payload = notification.payload;
                            const timeToShow = (notification.status === 'resolved' ? notification.resolvedAt : notification.createdAt) as string;
                            return (
                                <div key={notification.id} className="p-3 border rounded-md flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <div className="flex-1">
                                        <p className="font-medium">{payload.shiftLabel} ({payload.shiftTimeSlot.start} - {payload.shiftTimeSlot.end})</p>
                                        <p className="text-sm text-muted-foreground">{payload.requestingUser.userName} - {format(new Date(payload.shiftDate), 'dd/MM', { locale: vi })}</p>
                                        {notification.status === 'resolved' && payload.takenBy && <Badge className="mt-1 bg-green-600">Đã được nhận bởi {payload.takenBy.userName}</Badge>}
                                        {notification.status === 'cancelled' && <Badge variant="destructive" className="mt-1">Đã hủy lúc {format(new Date(timeToShow), "HH:mm")}</Badge>}
                                    </div>
                                    {renderRequestActions(notification)}
                                </div>
                            )
                        })}
                        </div>
                    ) : (
                         <div className="text-sm text-muted-foreground text-left py-4 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4"/>
                            <span>Không có lịch sử yêu cầu nào cho tuần này.</span>
                         </div>
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
