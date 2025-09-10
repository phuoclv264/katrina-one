

'use client';
import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { Schedule, ManagedUser, Notification, PassRequestPayload, AuthUser } from '@/lib/types';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

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
}: PassRequestsDialogProps) {
  
  const weeklyNotifications = useMemo(() => {
      return notifications.filter(n => n.type === 'pass_request' && n.payload.weekId === weekId);
  }, [notifications, weekId]);


  const { myRequests, otherRequests } = useMemo(() => {
    const myReqs: Notification[] = [];
    const otherReqs: Notification[] = [];

    weeklyNotifications.forEach(notification => {
      if (notification.status !== 'pending') return;
      const payload = notification.payload;

      if (payload.requestingUser.userId === currentUser.uid) {
        myReqs.push(notification);
      } else {
        const isDifferentRole = payload.shiftRole !== 'Bất kỳ' && currentUser.role !== payload.shiftRole;
        const hasDeclined = (payload.declinedBy || []).includes(currentUser.uid);
        // Simple conflict check (can be improved)
        const hasConflict = false; // Assuming schedule data isn't readily available here for a full check

        if (!isDifferentRole && !hasDeclined && !hasConflict) {
          otherReqs.push(notification);
        }
      }
    });

    return { myRequests: myReqs, otherRequests: otherReqs };
  }, [weeklyNotifications, currentUser]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Quản lý Yêu cầu Pass ca</DialogTitle>
          <DialogDescription>
            Xem xét các yêu cầu pass ca từ đồng nghiệp hoặc hủy yêu cầu của bạn.
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
                                <div key={notification.id} className="p-3 border rounded-md flex justify-between items-center">
                                    <div>
                                        <p className="font-medium">{payload.shiftLabel} ({payload.shiftTimeSlot.start} - {payload.shiftTimeSlot.end})</p>
                                        <p className="text-sm text-muted-foreground">{format(new Date(payload.shiftDate), 'eeee, dd/MM/yyyy', { locale: vi })}</p>
                                        <Badge variant="secondary" className="mt-1">Đang chờ người nhận</Badge>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => onCancel(notification.id)}>Hủy yêu cầu</Button>
                                </div>
                            )
                        })}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">Bạn không có yêu cầu nào đang chờ.</p>
                    )}
                </div>
                
                {/* Other's Requests */}
                <div>
                    <h3 className="font-semibold mb-2">Yêu cầu từ người khác</h3>
                     {otherRequests.length > 0 ? (
                        <div className="space-y-3">
                        {otherRequests.map(notification => {
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
      </DialogContent>
    </Dialog>
  );
}
