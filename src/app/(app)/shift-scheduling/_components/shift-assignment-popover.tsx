
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
import type { AssignedShift, Availability, ManagedUser, UserRole } from '@/lib/types';
import { cn } from '@/lib/utils';
import { isUserAvailable } from '@/lib/schedule-utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

type ShiftAssignmentDialogProps = {
  shift: AssignedShift;
  allUsers: ManagedUser[];
  dailyAvailability: Availability[];
  onSave: (shiftId: string, newAssignedUsers: {userId: string, userName: string}[]) => void;
  isOpen: boolean;
  onClose: () => void;
};

const roleOrder: Record<UserRole, number> = {
    'Phục vụ': 1,
    'Pha chế': 2,
    'Quản lý': 3,
    'Chủ nhà hàng': 4, // Should not be assigned, but included for completeness
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

  const sortedUsers = useMemo(() => {
    const shiftRole = shift.role;
    const roleFilteredUsers = allUsers.filter(user => shiftRole === 'Bất kỳ' || user.role === shiftRole);

    const availableUsers: ManagedUser[] = [];
    const busyUsers: ManagedUser[] = [];

    roleFilteredUsers.forEach(user => {
      if (isUserAvailable(user.uid, shift.timeSlot, dailyAvailability)) {
        availableUsers.push(user);
      } else {
        busyUsers.push(user);
      }
    });

    const sortFn = (a: ManagedUser, b: ManagedUser) => {
        const roleComparison = (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
        if (roleComparison !== 0) return roleComparison;
        return a.displayName.localeCompare(b.displayName, 'vi');
    };

    availableUsers.sort(sortFn);
    busyUsers.sort(sortFn);

    return { availableUsers, busyUsers };
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
                <DialogTitle>Phân công: {shift.label}</DialogTitle>
                <DialogDescription>
                    {format(parseISO(shift.date), 'eeee, dd/MM/yyyy', { locale: vi })}
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[50vh] pr-4">
                <div className="space-y-4">
                    {sortedUsers.availableUsers.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold mb-2">Nhân viên rảnh</h4>
                            <div className="space-y-2">
                            {sortedUsers.availableUsers.map(user => {
                                const isSelected = selectedUserIds.has(user.uid);
                                return (
                                    <Button
                                        key={user.uid}
                                        variant={isSelected ? "default" : "outline"}
                                        className="w-full justify-start h-auto p-3 text-left"
                                        onClick={() => handleSelectUser(user.uid)}
                                    >
                                        <div className="flex items-center w-full">
                                        <div className="flex-1">
                                                <p className="font-semibold">{user.displayName}</p>
                                                <p className="text-xs">{user.role}</p>
                                        </div>
                                        {isSelected && (
                                                <CheckCircle className="h-5 w-5 text-primary-foreground"/>
                                        )}
                                        </div>
                                    </Button>
                                );
                            })}
                            </div>
                        </div>
                    )}
                     {sortedUsers.busyUsers.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold mb-2">Nhân viên bận hoặc chưa đăng ký</h4>
                            <div className="space-y-2">
                            {sortedUsers.busyUsers.map(user => {
                                const isSelected = selectedUserIds.has(user.uid);
                                return (
                                    <Button
                                        key={user.uid}
                                        variant={isSelected ? "secondary" : "outline"}
                                        className="w-full justify-start h-auto p-3 text-left opacity-70"
                                        onClick={() => handleSelectUser(user.uid)}
                                    >
                                        <div className="flex items-center w-full">
                                        <div className="flex-1">
                                                <p className="font-semibold">{user.displayName}</p>
                                                <p className="text-xs">{user.role}</p>
                                        </div>
                                        {isSelected && <Badge variant="destructive">Chọn dù bận</Badge>}
                                        </div>
                                    </Button>
                                );
                            })}
                            </div>
                        </div>
                    )}
                    {sortedUsers.availableUsers.length === 0 && sortedUsers.busyUsers.length === 0 && (
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
