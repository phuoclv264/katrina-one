
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
import type { Schedule, ManagedUser, PassRequest, AssignedShift, AuthUser } from '@/lib/types';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

type PassRequestsDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule | null;
  currentUser: AuthUser;
  allUsers: ManagedUser[];
  onAccept: (shift: AssignedShift) => void;
  onDecline: (shift: AssignedShift, passRequest: PassRequest) => void;
  onCancel: (shift: AssignedShift, passRequest: PassRequest) => void;
};

export default function PassRequestsDialog({
  isOpen,
  onClose,
  schedule,
  currentUser,
  allUsers,
  onAccept,
  onDecline,
  onCancel,
}: PassRequestsDialogProps) {
  
  const { myRequests, otherRequests } = useMemo(() => {
    if (!schedule) return { myRequests: [], otherRequests: [] };

    const myReqs: { shift: AssignedShift; request: PassRequest }[] = [];
    const otherReqs: { shift: AssignedShift; request: PassRequest }[] = [];

    schedule.shifts.forEach(shift => {
      shift.passRequests?.forEach(request => {
        if (request.status === 'pending') {
          if (request.requestingUser.userId === currentUser.uid) {
            myReqs.push({ shift, request });
          } else {
            // Check if current user is eligible
            const isDifferentRole = shift.role !== 'Bất kỳ' && currentUser.role !== shift.role;
            const hasDeclined = (request.declinedBy || []).includes(currentUser.uid);
            
            // Check for schedule conflicts
            const shiftStartTime = new Date(`${shift.date}T${shift.timeSlot.start}:00`);
            const shiftEndTime = new Date(`${shift.date}T${shift.timeSlot.end}:00`);
            const hasConflict = schedule.shifts.some(existingShift => {
                if (existingShift.date !== shift.date) return false;
                if (!existingShift.assignedUsers.some(u => u.userId === currentUser.uid)) return false;
                
                const existingStartTime = new Date(`${existingShift.date}T${existingShift.timeSlot.start}:00`);
                const existingEndTime = new Date(`${existingShift.date}T${existingShift.timeSlot.end}:00`);
                return shiftStartTime < existingEndTime && shiftEndTime > existingStartTime;
            });

            if (!isDifferentRole && !hasDeclined && !hasConflict) {
              otherReqs.push({ shift, request });
            }
          }
        }
      });
    });

    return { myRequests: myReqs, otherRequests: otherReqs };
  }, [schedule, currentUser]);
  
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
                        {myRequests.map(({ shift, request }) => (
                            <div key={`${shift.id}-${request.requestingUser.userId}`} className="p-3 border rounded-md flex justify-between items-center">
                                <div>
                                    <p className="font-medium">{shift.label} ({shift.timeSlot.start} - {shift.timeSlot.end})</p>
                                    <p className="text-sm text-muted-foreground">{format(new Date(shift.date), 'eeee, dd/MM/yyyy', { locale: vi })}</p>
                                    <Badge variant="secondary" className="mt-1">Đang chờ người nhận</Badge>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => onCancel(shift, request)}>Hủy yêu cầu</Button>
                            </div>
                        ))}
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
                        {otherRequests.map(({ shift, request }) => (
                            <div key={`${shift.id}-${request.requestingUser.userId}`} className="p-3 border rounded-md flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                <div className="flex-1">
                                    <p className="font-medium">{request.requestingUser.userName} muốn pass ca</p>
                                    <p className="text-sm text-muted-foreground">{shift.label}: {shift.timeSlot.start} - {shift.timeSlot.end}, {format(new Date(shift.date), 'dd/MM', { locale: vi })}</p>
                                </div>
                                <div className="flex gap-2 self-end sm:self-center">
                                    <Button variant="outline" size="sm" onClick={() => onDecline(shift, request)}><XCircle className="mr-2 h-4 w-4"/>Từ chối</Button>
                                    <Button size="sm" onClick={() => onAccept(shift)}><CheckCircle className="mr-2 h-4 w-4"/>Nhận ca</Button>
                                </div>
                            </div>
                        ))}
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
