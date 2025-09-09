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
import { Check, UserPlus, Trash2, MoreVertical } from 'lucide-react';
import type { AssignedShift, Availability, ManagedUser, TimeSlot } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { isUserAvailable } from '@/lib/schedule-utils';
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

type ShiftAssignmentPopoverProps = {
  shift: AssignedShift;
  availableUsers: ManagedUser[];
  dailyAvailability: Availability[];
  onUpdateAssignment: (shiftId: string, newAssignedUsers: {userId: string, userName: string}[]) => void;
  onDelete: (shiftId: string) => void;
  canEdit: boolean;
};

export default function ShiftAssignmentPopover({
  shift,
  availableUsers,
  dailyAvailability,
  onUpdateAssignment,
  onDelete,
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
  
  if (!canEdit) {
      return (
         <div className="bg-muted p-2 rounded-md text-sm">
            <p className="font-bold">{shift.label}</p>
            <p className="text-xs text-muted-foreground">{shift.timeSlot.start} - {shift.timeSlot.end}</p>
            <div className="mt-1 flex flex-wrap gap-1">
                {shift.assignedUsers.map(user => (
                    <Badge key={user.userId} variant="default">{user.userName}</Badge>
                ))}
            </div>
        </div>
      )
  }

  return (
    <div className="flex items-center gap-1">
        <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start h-auto">
                <div className="text-left py-1">
                    <p className="font-semibold text-sm">{shift.label}</p>
                    <p className="text-xs text-muted-foreground">{shift.timeSlot.start} - {shift.timeSlot.end}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                        {shift.assignedUsers.map(user => (
                            <Badge key={user.userId} variant="secondary">{user.userName}</Badge>
                        ))}
                        {shift.assignedUsers.length === 0 && (
                            <span className="text-xs text-muted-foreground italic">Chưa có ai</span>
                        )}
                    </div>
                </div>
            </Button>
        </PopoverTrigger>
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
        </Popover>
        <AlertDialog>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                     <AlertDialogTrigger asChild>
                        <DropdownMenuItem className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4"/> Xóa ca
                        </DropdownMenuItem>
                    </AlertDialogTrigger>
                </DropdownMenuContent>
            </DropdownMenu>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Xác nhận xóa ca làm việc?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Hành động này sẽ xóa ca "{shift.label}" khỏi lịch tuần này.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(shift.id)}>Xóa</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

