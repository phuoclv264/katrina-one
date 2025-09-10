
'use client';

import React, { useState, useMemo } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Check, UserPlus } from 'lucide-react';
import type { AssignedShift, Availability, ManagedUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import { isUserAvailable } from '@/lib/schedule-utils';

type ShiftAssignmentPopoverProps = {
  shift: AssignedShift;
  availableUsers: ManagedUser[];
  dailyAvailability: Availability[];
  onUpdateAssignment: (shiftId: string, newAssignedUsers: {userId: string, userName: string}[]) => void;
  canEdit: boolean;
};

export default function ShiftAssignmentPopover({
  shift,
  availableUsers,
  dailyAvailability,
  onUpdateAssignment,
  canEdit,
}: ShiftAssignmentPopoverProps) {
  const [open, setOpen] = useState(false);

  const usersAvailableForShift = useMemo(() => {
    return availableUsers.filter(user => 
        isUserAvailable(user.uid, shift.timeSlot, dailyAvailability)
    );
  }, [availableUsers, shift.timeSlot, dailyAvailability]);

  const handleSelectUser = (user: ManagedUser) => {
    const isSelected = shift.assignedUsers.some(u => u.userId === user.uid);
    let newAssignedUsers;
    if (isSelected) {
      newAssignedUsers = shift.assignedUsers.filter(u => u.userId !== user.uid);
    } else {
      newAssignedUsers = [...shift.assignedUsers, { userId: user.uid, userName: user.displayName }];
    }
    onUpdateAssignment(shift.id, newAssignedUsers);
  };
  
  const popoverContent = (
    <PopoverContent className="w-64 p-0">
        <Command>
        <CommandInput placeholder="Tìm nhân viên..." />
        <CommandList>
            <CommandEmpty>Không tìm thấy nhân viên nào rảnh.</CommandEmpty>
            <CommandGroup>
            {usersAvailableForShift.map(user => {
                const isSelected = shift.assignedUsers.some(u => u.userId === user.uid);
                return (
                <CommandItem key={user.uid} onSelect={() => handleSelectUser(user)}>
                    <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                    {user.displayName}
                </CommandItem>
                );
            })}
            </CommandGroup>
        </CommandList>
        </Command>
    </PopoverContent>
  )

  return (
      <Popover open={open} onOpenChange={setOpen}>
        <div className="space-y-1">
            <div className="flex flex-wrap gap-1">
                 {shift.assignedUsers.map(user => (
                    <Badge key={user.userId} variant="secondary" className="text-xs">{user.userName}</Badge>
                ))}
            </div>
             {canEdit ? (
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                        <UserPlus className="h-4 w-4" />
                        <span className="sr-only">Phân công</span>
                    </Button>
                </PopoverTrigger>
            ) : (
                 shift.assignedUsers.length === 0 && <p className="text-xs text-muted-foreground italic text-center pt-2">Trống</p>
            )}
        </div>
        {popoverContent}
    </Popover>
  );
}
