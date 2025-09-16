
'use client';
import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck, Send, Loader2 } from 'lucide-react';
import type { ManagedUser, Schedule, AssignedShift, Availability } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { isUserAvailable, hasTimeConflict } from '@/lib/schedule-utils';
import { ScrollArea } from '@/components/ui/scroll-area';

type ShiftInfoDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  shift: AssignedShift;
  schedule: Schedule;
  allUsers: ManagedUser[];
  onDirectPassRequest: (shift: AssignedShift, targetUser: ManagedUser) => void;
  isProcessing: boolean;
};

export default function ShiftInfoDialog({
  isOpen,
  onClose,
  shift,
  schedule,
  allUsers,
  onDirectPassRequest,
  isProcessing,
}: ShiftInfoDialogProps) {

  const parseTime = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };
  
  const { colleagues, availableStaff } = useMemo(() => {
    if (!shift || !schedule) return { colleagues: [], availableStaff: [] };

    const shiftDate = shift.date;
    const shiftStart = parseTime(shift.timeSlot.start);
    const shiftEnd = parseTime(shift.timeSlot.end);

    // Find colleagues
    const overlappingShifts = schedule.shifts.filter(s =>
      s.date === shiftDate &&
      s.id !== shift.id &&
      parseTime(s.timeSlot.start) < shiftEnd &&
      shiftStart < parseTime(s.timeSlot.end)
    );

    const colleagueIds = new Set<string>();
    overlappingShifts.forEach(s => {
      s.assignedUsers.forEach(u => colleagueIds.add(u.userId));
    });

    const colleagues = allUsers.filter(u => colleagueIds.has(u.uid));

    // Find available staff
    const availabilityForDay = schedule.availability.filter(a => a.date === shiftDate);
    const availableStaff = allUsers.filter(u => {
        // Exclude self
        if (shift.assignedUsers.some(au => au.userId === u.uid)) return false;
        // Check availability
        return isUserAvailable(u.uid, shift.timeSlot, availabilityForDay);
    });

    return { colleagues, availableStaff };
  }, [shift, schedule, allUsers]);

  if (!shift) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thông tin ca: {shift.label}</DialogTitle>
          <DialogDescription>
            {format(parseISO(shift.date), 'eeee, dd/MM/yyyy', { locale: vi })} | {shift.timeSlot.start} - {shift.timeSlot.end}
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="colleagues" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="colleagues"><Users className="mr-2 h-4 w-4" />Đồng nghiệp ({colleagues.length})</TabsTrigger>
            <TabsTrigger value="available"><UserCheck className="mr-2 h-4 w-4" />Nhân viên rảnh ({availableStaff.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="colleagues">
             <ScrollArea className="h-72 mt-4">
                {colleagues.length > 0 ? (
                    <div className="space-y-2 pr-4">
                    {colleagues.map(user => (
                        <Card key={user.uid}>
                        <CardContent className="p-3">
                            <p className="font-semibold">{user.displayName}</p>
                            <p className="text-sm text-muted-foreground">{user.role}</p>
                        </CardContent>
                        </Card>
                    ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Không có đồng nghiệp nào làm cùng khung giờ này.</p>
                )}
             </ScrollArea>
          </TabsContent>
          <TabsContent value="available">
             <ScrollArea className="h-72 mt-4">
                 {availableStaff.length > 0 ? (
                    <div className="space-y-2 pr-4">
                        {availableStaff.map(user => (
                            <Card key={user.uid}>
                                <CardContent className="p-3 flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold">{user.displayName}</p>
                                        <p className="text-sm text-muted-foreground">{user.role}</p>
                                    </div>
                                    <Button size="sm" onClick={() => onDirectPassRequest(shift, user)} disabled={isProcessing}>
                                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                                        Nhờ nhận ca
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Không có nhân viên nào rảnh trong khung giờ này.</p>
                )}
             </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
