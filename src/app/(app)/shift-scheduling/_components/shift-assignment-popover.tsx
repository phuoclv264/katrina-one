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
import { Check, UserPlus, Trash2, MoreVertical, Clock } from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
    <Card className="bg-background shadow-sm">
        <CardHeader className="p-3 flex flex-row items-start justify-between">
            <div>
                <CardTitle className="text-sm">{shift.label}</CardTitle>
                <CardDescription className="text-xs flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3"/>
                    {shift.timeSlot.start} - {shift.timeSlot.end}
                </CardDescription>
            </div>
            {canEdit && (
                <AlertDialog>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
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
            )}
        </CardHeader>
        <CardContent className="p-3 pt-0">
             <div className="flex flex-wrap gap-1 mb-2">
                {shift.assignedUsers.map(user => (
                    <Badge key={user.userId} variant="secondary">{user.userName}</Badge>
                ))}
            </div>
             {canEdit ? (
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="xs" className="w-full h-7">
                            <UserPlus className="mr-2 h-3 w-3" />
                            {shift.assignedUsers.length > 0 ? 'Chỉnh sửa' : 'Phân công'}
                        </Button>
                    </PopoverTrigger>
                    {popoverContent}
                </Popover>
            ) : (
                 shift.assignedUsers.length === 0 && <p className="text-xs text-muted-foreground italic">Chưa có ai được phân công.</p>
            )}
        </CardContent>
    </Card>
  );
}
