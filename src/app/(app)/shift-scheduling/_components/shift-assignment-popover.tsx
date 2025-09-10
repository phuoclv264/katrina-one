
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
import { User, CheckCircle } from 'lucide-react';
import type { AssignedShift, Availability, ManagedUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import { isUserAvailable } from '@/lib/schedule-utils';
import { ScrollArea } from '@/components/ui/scroll-area';

type ShiftAssignmentDialogProps = {
  shift: AssignedShift;
  allUsers: ManagedUser[];
  dailyAvailability: Availability[];
  onSave: (shiftId: string, newAssignedUsers: {userId: string, userName: string}[]) => void;
  isOpen: boolean;
  onClose: () => void;
};

export default function ShiftAssignmentDialog({
  shift,
  allUsers,
  dailyAvailability,
  onSave,
  isOpen,
  onClose,
}: ShiftAssignmentDialogProps) {
    
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setSelectedUserIds(new Set(shift.assignedUsers.map(u => u.userId)));
    }
  }, [isOpen, shift.assignedUsers]);

  const usersAvailableForShift = useMemo(() => {
    const shiftRole = shift.role;
    const roleFilteredUsers = allUsers.filter(user => shiftRole === 'Bất kỳ' || user.role === shiftRole);
    
    return roleFilteredUsers.map(user => ({
        user,
        isAvailable: isUserAvailable(user.uid, shift.timeSlot, dailyAvailability)
    })).sort((a, b) => {
        // Prioritize available users
        if (a.isAvailable && !b.isAvailable) return -1;
        if (!a.isAvailable && b.isAvailable) return 1;
        // Then sort by name
        return a.user.displayName.localeCompare(b.user.displayName);
    });
  }, [allUsers, shift.role, shift.timeSlot, dailyAvailability]);

  const handleSelectUser = (userId: string) => {
    setSelectedUserIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(userId)) {
            newSet.delete(userId);
        } else {
            newSet.add(userId);
        }
        return newSet;
    });
  };

  const handleSave = () => {
    const newAssignedUsers = Array.from(selectedUserIds).map(userId => {
        const user = allUsers.find(u => u.uid === userId);
        return { userId, userName: user?.displayName || 'Unknown' };
    });
    onSave(shift.id, newAssignedUsers);
    onClose();
  };

  return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>Phân công ca: {shift.label}</DialogTitle>
                <DialogDescription>
                    Chọn nhân viên để thêm vào ca làm việc này. Chỉ những nhân viên có thời gian rảnh phù hợp mới được ưu tiên hiển thị.
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[50vh] pr-4">
                <div className="space-y-2">
                {usersAvailableForShift.map(({user, isAvailable}) => {
                    const isSelected = selectedUserIds.has(user.uid);
                    return (
                         <Button
                            key={user.uid}
                            variant={isSelected ? "default" : "outline"}
                            className={cn(
                                "w-full justify-start h-auto p-3 text-left",
                                !isAvailable && "opacity-50 line-through"
                            )}
                            onClick={() => handleSelectUser(user.uid)}
                         >
                            <div className="flex items-center w-full">
                               <div className="flex-1">
                                    <p className="font-semibold">{user.displayName}</p>
                                    <p className="text-xs">{user.role}</p>
                               </div>
                                {isAvailable && isSelected && (
                                    <CheckCircle className="h-5 w-5 text-primary-foreground"/>
                                )}
                                 {isAvailable && !isSelected && (
                                    <div className="w-5 h-5"/>
                                )}
                                {!isAvailable && (
                                     <Badge variant="destructive" className="text-xs">Bận</Badge>
                                )}
                            </div>
                         </Button>
                    );
                })}
                {usersAvailableForShift.length === 0 && (
                    <p className="text-sm text-center text-muted-foreground py-8">Không có nhân viên nào thuộc vai trò này.</p>
                )}
                </div>
            </ScrollArea>
            <DialogFooter>
                <Button variant="outline" onClick={onClose}>Hủy</Button>
                <Button onClick={handleSave}>Lưu thay đổi</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}