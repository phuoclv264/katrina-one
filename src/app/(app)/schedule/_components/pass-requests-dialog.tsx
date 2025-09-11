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
import type { Schedule, ManagedUser, Notification, PassRequestPayload, AuthUser } from '@/lib/types';
import { format } from 'date-fns';
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
  onAccept,
  onDecline,
  onCancel,
  onRevert,
  onAssign,
}: PassRequestsDialogProps) {
  
  const canManage = currentUser.role === 'Quản lý' || currentUser.role === 'Chủ nhà hàng';

  const { myRequests, otherPendingRequests, completedRequests } = useMemo(() => {
    const myReqs: Notification[] = [];
    const otherReqs: Notification[] = [];
    const completed: Notification[] = [];

    notifications.forEach(notification => {
      const payload = notification.payload;
      if (notification.type !== 'pass_request') return;
      
      // My Requests
      if (payload.requestingUser.userId === currentUser.uid) {
        myReqs.push(notification);
        return;
      }
      
      // Other's requests for me to see
      if (notification.status === 'pending') {
         const isDifferentRole = payload.shiftRole !== 'Bất kỳ' && currentUser.role !== payload.shiftRole;
         const hasDeclined = (payload.declinedBy || []).includes(currentUser.uid);
         if (!isDifferentRole && !hasDeclined) {
            otherReqs.push(notification);
         }
      }
      
      // Completed requests (for managers to see)
      if (canManage && (notification.status === 'resolved' || notification.status === 'cancelled')) {
          completed.push(notification);
      }
    });

    myReqs.sort((a, b) => {
        const statusOrder: { [key: string]: number } = { 'pending': 0, 'resolved': 1, 'cancelled': 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
        return new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime();
    });
    
    otherReqs.sort((a,b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
    completed.sort((a,b) => {
        const timeA = a.resolvedAt || a.createdAt;
        const timeB = b.resolvedAt || b.createdAt;
        return new Date(timeB as string).getTime() - new Date(timeA as string).getTime();
    });


    return { myRequests: myReqs, otherPendingRequests: otherReqs, completedRequests: completed };
  }, [notifications, currentUser, canManage]);
  
  const renderRequestActions = (notification: Notification) => {
      if (canManage) {
        if (notification.status === 'pending') {
           return (
            <div className="flex gap-2 self-end sm:self-center">
                 <Button variant="secondary" size="sm" onClick={() => onAssign(notification)}>
                    <UserCheck className="mr-2 h-4 w-4"/> Chỉ định
                </Button>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                         <Button variant="destructive" size="sm">
                            <Trash2 className="mr-2 h-4 w-4"/> Hủy
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                         <AlertDialogHeader><AlertDialogTitle>Hủy yêu cầu pass ca?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ hủy yêu cầu của {notification.payload.requestingUser.userName}. Nhân viên này sẽ tiếp tục chịu trách nhiệm cho ca làm việc.</AlertDialogDescription></AlertDialogHeader>
                         <AlertDialogFooter><AlertDialogCancel>Không</AlertDialogCancel><AlertDialogAction onClick={() => onCancel(notification.id)}>Xác nhận Hủy</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
          );
        }
        if (notification.status === 'resolved') {
           return (
            <div className="flex gap-2 self-end sm:self-center">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                         <Button variant="outline" size="sm"><Undo className="mr-2 h-4 w-4"/>Hoàn tác</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                         <AlertDialogHeader><AlertDialogTitle>Hoàn tác yêu cầu?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ gán ca làm việc trở lại cho nhân viên ban đầu ({notification.payload.requestingUser.userName}) và đặt lại trạng thái yêu cầu này.</AlertDialogDescription></AlertDialogHeader>
                         <AlertDialogFooter><AlertDialogCancel>Không</AlertDialogCancel><AlertDialogAction onClick={() => onRevert(notification)}>Xác nhận Hoàn tác</AlertDialogAction></AlertDialogFooter>
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
            Xem xét các yêu cầu pass ca từ đồng nghiệp hoặc quản lý các yêu cầu của bạn.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] -mx-6 px-6">
            <div className="space-y-6">
                {/* My Requests (for staff) / All Pending (for manager) */}
                <div>
                    <h3 className="font-semibold mb-2">{canManage ? 'Yêu cầu đang chờ xử lý' : 'Yêu cầu của bạn'}</h3>
                    {(canManage ? otherPendingRequests : myRequests).length > 0 ? (
                        <div className="space-y-3">
                        {(canManage ? otherPendingRequests : myRequests).map(notification => {
                            const payload = notification.payload;
                            return (
                                <div key={notification.id} className="p-3 border rounded-md flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <div className="flex-1">
                                        <p className="font-medium">{payload.shiftLabel} ({payload.shiftTimeSlot.start} - {payload.shiftTimeSlot.end})</p>
                                        <p className="text-sm text-muted-foreground">{payload.requestingUser.userName} - {format(new Date(payload.shiftDate), 'eeee, dd/MM/yyyy', { locale: vi })}</p>
                                        {notification.status === 'pending' && <Badge variant="secondary" className="mt-1">Đang chờ</Badge>}
                                        {notification.status === 'resolved' && payload.takenBy && <Badge className="mt-1 bg-green-600">Đã được nhận bởi {payload.takenBy.userName}</Badge>}
                                        {notification.status === 'cancelled' && <Badge variant="destructive" className="mt-1">Đã hủy</Badge>}
                                    </div>
                                    {renderRequestActions(notification)}
                                </div>
                            )
                        })}
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground text-left py-4 flex items-center gap-2">
                            <Info className="h-4 w-4"/>
                            <span>{canManage ? "Không có yêu cầu nào đang chờ." : "Bạn không có yêu cầu nào."}</span>
                        </div>
                    )}
                </div>
                
                {/* Other's Requests (for staff) / Completed (for manager) */}
                <div>
                    <h3 className="font-semibold mb-2">{canManage ? 'Lịch sử yêu cầu đã xử lý' : 'Yêu cầu từ người khác'}</h3>
                     {(canManage ? completedRequests : otherPendingRequests).length > 0 ? (
                        <div className="space-y-3">
                        {(canManage ? completedRequests : otherPendingRequests).map(notification => {
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
                            <span>{canManage ? 'Chưa có yêu cầu nào được xử lý.' : 'Không có yêu cầu nào phù hợp.'}</span>
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
