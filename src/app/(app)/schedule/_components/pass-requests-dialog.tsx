

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
import { AlertCircle, CheckCircle, XCircle, Undo, Info } from 'lucide-react';
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
  weekId: string;
  notifications: Notification[];
  currentUser: AuthUser;
  allUsers: ManagedUser[];
  onAccept: (notification: Notification) => void;
  onDecline: (notification: Notification) => void;
  onCancel: (notificationId: string) => void;
  onRevert: (notification: Notification) => void;
};

export default function PassRequestsDialog({
  isOpen,
  onClose,
  weekId,
  notifications,
  currentUser,
  allUsers,
  onAccept,
  onDecline,
  onCancel,
  onRevert,
}: PassRequestsDialogProps) {
  
  const canManage = currentUser.role === 'Quản lý' || currentUser.role === 'Chủ nhà hàng';

  const weeklyNotifications = useMemo(() => {
      return notifications.filter(n => n.type === 'pass_request' && n.payload.weekId === weekId);
  }, [notifications, weekId]);


  const { myRequests, otherPendingRequests } = useMemo(() => {
    const myReqs: Notification[] = [];
    const otherReqs: Notification[] = [];

    weeklyNotifications.forEach(notification => {
      const payload = notification.payload;
      
      if (payload.requestingUser.userId === currentUser.uid) {
        myReqs.push(notification);
      } else if (notification.status === 'pending') {
        const isDifferentRole = payload.shiftRole !== 'Bất kỳ' && currentUser.role !== payload.shiftRole;
        const hasDeclined = (payload.declinedBy || []).includes(currentUser.uid);
        // Simple conflict check (can be improved)
        const hasConflict = false; // Assuming schedule data isn't readily available here for a full check

        if (!isDifferentRole && !hasDeclined && !hasConflict) {
          otherReqs.push(notification);
        }
      }
    });

    // Sort my requests by status and then date
    myReqs.sort((a, b) => {
        const statusOrder = { pending: 0, taken: 1, cancelled: 2 };
        if (statusOrder[a.status] !== statusOrder[b.status]) {
            return statusOrder[a.status] - statusOrder[b.status];
        }
        return new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime();
    })


    return { myRequests: myReqs, otherPendingRequests: otherReqs };
  }, [weeklyNotifications, currentUser]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quản lý Yêu cầu Pass ca</DialogTitle>
          <DialogDescription>
            Xem xét các yêu cầu pass ca từ đồng nghiệp hoặc quản lý các yêu cầu của bạn.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6">
                {/* My Requests */}
                <div>
                    <h3 className="font-semibold mb-2">Yêu cầu của bạn</h3>
                    {myRequests.length > 0 ? (
                        <div className="space-y-3">
                        {myRequests.map(notification => {
                            const payload = notification.payload;
                            return (
                                <div key={notification.id} className="p-3 border rounded-md flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <div className="flex-1">
                                        <p className="font-medium">{payload.shiftLabel} ({payload.shiftTimeSlot.start} - {payload.shiftTimeSlot.end})</p>
                                        <p className="text-sm text-muted-foreground">{format(new Date(payload.shiftDate), 'eeee, dd/MM/yyyy', { locale: vi })}</p>
                                        {notification.status === 'pending' && <Badge variant="secondary" className="mt-1">Đang chờ người nhận</Badge>}
                                        {notification.status === 'resolved' && payload.takenBy && <Badge className="mt-1 bg-green-600">Đã được nhận bởi {payload.takenBy.userName}</Badge>}
                                        {notification.status === 'cancelled' && <Badge variant="destructive" className="mt-1">Đã hủy</Badge>}
                                    </div>
                                    <div className="flex gap-2 self-end sm:self-center">
                                        {notification.status === 'pending' && (
                                            <Button variant="outline" size="sm" onClick={() => onCancel(notification.id)}>Hủy yêu cầu</Button>
                                        )}
                                        {notification.status === 'resolved' && canManage && (
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                     <Button variant="outline" size="sm"><Undo className="mr-2 h-4 w-4"/>Hoàn tác</Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                     <AlertDialogHeader><AlertDialogTitle>Hoàn tác yêu cầu?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ gán ca làm việc trở lại cho bạn và đặt lại trạng thái yêu cầu.</AlertDialogDescription></AlertDialogHeader>
                                                     <AlertDialogFooter><AlertDialogCancel>Không</AlertDialogCancel><AlertDialogAction onClick={() => onRevert(notification)}>Xác nhận</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground text-center py-4 flex items-center justify-center gap-2">
                            <Info className="h-4 w-4"/>
                            <span>Bạn không có yêu cầu nào trong tuần này.</span>
                        </div>
                    )}
                </div>
                
                {/* Other's Requests */}
                <div>
                    <h3 className="font-semibold mb-2">Yêu cầu từ người khác</h3>
                     {otherPendingRequests.length > 0 ? (
                        <div className="space-y-3">
                        {otherPendingRequests.map(notification => {
                            const payload = notification.payload;
                            return (
                                <div key={notification.id} className="p-3 border rounded-md flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <div className="flex-1">
                                        <p className="font-medium">{payload.requestingUser.userName} muốn pass ca</p>
                                        <p className="text-sm text-muted-foreground">{payload.shiftLabel}: {payload.shiftTimeSlot.start} - {payload.shiftTimeSlot.end}, {format(new Date(payload.shiftDate), 'dd/MM', { locale: vi })}</p>
                                    </div>
                                    <div className="flex gap-2 self-end sm:self-center">
                                        <Button variant="outline" size="sm" onClick={() => onDecline(notification)}><XCircle className="mr-2 h-4 w-4"/>Từ chối</Button>
                                        <Button size="sm" onClick={() => onAccept(notification)}><CheckCircle className="mr-2 h-4 w-4"/>Nhận ca</Button>
                                    </div>
                                </div>
                            )
                        })}
                        </div>
                    ) : (
                         <div className="text-sm text-muted-foreground text-center py-4 flex items-center justify-center gap-2">
                            <AlertCircle className="h-4 w-4"/>
                            <span>Không có yêu cầu nào phù hợp.</span>
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
