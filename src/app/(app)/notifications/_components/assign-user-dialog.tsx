

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Notification, ManagedUser, Schedule, Availability } from '@/lib/types';
import { cn } from '@/lib/utils';
import { isUserAvailable } from '@/lib/schedule-utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { dataStore } from '@/lib/data-store';
import { getISOWeek, parseISO } from 'date-fns';

type AssignUserDialogProps = {
  notification: Notification;
  allUsers: ManagedUser[];
  onSave: (assignedUser: ManagedUser) => void;
  isOpen: boolean;
  onClose: () => void;
};

export default function AssignUserDialog({
  notification,
  allUsers,
  onSave,
  isOpen,
  onClose,
}: AssignUserDialogProps) {
    
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [dailyAvailability, setDailyAvailability] = useState<Availability[]>([]);

  const { payload } = notification;

  useEffect(() => {
    if (isOpen) {
      setSelectedUserId(null); // Reset selection on open
      
      const unsub = dataStore.subscribeToSchedule(payload.weekId, (schedule) => {
        if (schedule) {
            setDailyAvailability(schedule.availability.filter(a => a.date === payload.shiftDate));
        } else {
            setDailyAvailability([]);
        }
      });

      return () => unsub();
    }
  }, [isOpen, payload.weekId, payload.shiftDate]);

  const usersAvailableForShift = useMemo(() => {
    const shiftRole = payload.shiftRole;
    const roleFilteredUsers = allUsers.filter(user => 
        (shiftRole === 'Bất kỳ' || user.role === shiftRole)
    );
    
    return roleFilteredUsers.map(user => ({
        user,
        isAvailable: isUserAvailable(user.uid, payload.shiftTimeSlot, dailyAvailability)
    })).sort((a, b) => {
        if (a.isAvailable && !b.isAvailable) return -1;
        if (!a.isAvailable && b.isAvailable) return 1;
        return a.user.displayName.localeCompare(b.user.displayName);
    });
  }, [allUsers, payload.shiftRole, payload.shiftTimeSlot, dailyAvailability]);


  const handleSave = () => {
    if (selectedUserId) {
        const userToAssign = allUsers.find(u => u.uid === selectedUserId);
        if (userToAssign) {
             onSave(userToAssign);
        }
    }
  };

  return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>Chỉ định nhân viên</DialogTitle>
                <DialogDescription>
                    Chọn một nhân viên để thay thế cho ca: <span className="font-semibold">{payload.shiftLabel} ({payload.shiftTimeSlot.start} - {payload.shiftTimeSlot.end})</span>.
                    Những người có lịch rảnh sẽ được ưu tiên hiển thị.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[50vh] pr-4">
                <div className="space-y-2">
                {usersAvailableForShift.map(({user, isAvailable}) => {
                    const isSelected = selectedUserId === user.uid;
                    return (
                         <Button
                            key={user.uid}
                            variant={isSelected ? "default" : "outline"}
                            className="w-full justify-start h-auto p-3 text-left"
                            onClick={() => setSelectedUserId(user.uid)}
                         >
                            <div className="flex-1">
                                <p className="font-semibold">{user.displayName}</p>
                                <p className="text-xs">{user.role}</p>
                            </div>
                            {isAvailable ? (
                                <Badge variant={isSelected ? "secondary" : "default"}>Rảnh</Badge>
                            ) : (
                                <Badge variant="destructive">Bận</Badge>
                            )}
                         </Button>
                    );
                })}
                {usersAvailableForShift.length === 0 && (
                    <p className="text-sm text-center text-muted-foreground py-8">Không có nhân viên phù hợp.</p>
                )}
                </div>
            </ScrollArea>
            <DialogFooter>
                <Button variant="outline" onClick={onClose}>Hủy</Button>
                <Button onClick={handleSave} disabled={!selectedUserId}>Xác nhận chỉ định</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
