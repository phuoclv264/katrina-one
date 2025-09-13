
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
import { User, CheckCircle, AlertCircle } from 'lucide-react';
import type { AssignedShift, Availability, ManagedUser, UserRole, AssignedUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import { isUserAvailable, hasTimeConflict } from '@/lib/schedule-utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

type ShiftAssignmentDialogProps = {
  shift: AssignedShift;
  allUsers: ManagedUser[];
  currentUserRole: UserRole;
  dailyAvailability: Availability[];
  onSave: (shiftId: string, newAssignedUsers: AssignedUser[]) => void;
  isOpen: boolean;
  onClose: () => void;
  allShiftsOnDay: AssignedShift[];
  passRequestingUser?: AssignedUser | null;
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
  currentUserRole,
  dailyAvailability,
  onSave,
  isOpen,
  onClose,
  allShiftsOnDay,
  passRequestingUser,
}: ShiftAssignmentDialogProps) {
    
  const { toast } = useToast();
  const isPassAssignmentMode = !!passRequestingUser;
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [conflictError, setConflictError] = useState<{ userName: string; shiftLabel: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (isPassAssignmentMode) {
        // In pass assignment mode, selection is cleared initially.
        setSelectedUserIds(new Set());
      } else {
        setSelectedUserIds(new Set(shift.assignedUsers.map(u => u.userId)));
      }
      setConflictError(null);
    }
  }, [isOpen, shift.assignedUsers, isPassAssignmentMode]);

  const sortedUsers = useMemo(() => {
    const shiftRole = shift.role;
    let roleFilteredUsers = allUsers.filter(user => shiftRole === 'Bất kỳ' || user.role === shiftRole);

    // In pass assignment mode, filter out the user who is making the request
    if (isPassAssignmentMode && passRequestingUser) {
        roleFilteredUsers = roleFilteredUsers.filter(user => user.uid !== passRequestingUser.userId);
    }


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
  }, [allUsers, shift.role, shift.timeSlot, dailyAvailability, isPassAssignmentMode, passRequestingUser]);
  
  const handleSelectUser = (user: ManagedUser) => {
    // Prevent manager from selecting busy users. Only owner can.
    const isAvailable = isUserAvailable(user.uid, shift.timeSlot, dailyAvailability);
    if (currentUserRole === 'Quản lý' && !isAvailable) {
        toast({
            title: "Không thể chọn",
            description: "Nhân viên này không đăng ký rảnh. Chỉ Chủ nhà hàng mới có thể xếp.",
            variant: "default",
        });
        return;
    }


    if (isPassAssignmentMode) {
      // Single selection mode
      const newSet = new Set<string>();
      if (!selectedUserIds.has(user.uid)) {
        // Check for conflicts before adding
        const conflict = hasTimeConflict(user.uid, shift, allShiftsOnDay);
        if (conflict) {
          setConflictError({ userName: user.displayName, shiftLabel: conflict.label });
          return;
        }
        newSet.add(user.uid);
      }
      // If the user is already selected, clicking again deselects them.
      setSelectedUserIds(newSet);
    } else {
      // Multi-selection mode
      const newSet = new Set(selectedUserIds);
      if (newSet.has(user.uid)) {
        newSet.delete(user.uid);
      } else {
        // Check for conflicts before adding
        const conflict = hasTimeConflict(user.uid, shift, allShiftsOnDay);
        if (conflict) {
          setConflictError({ userName: user.displayName, shiftLabel: conflict.label });
          return;
        }
        newSet.add(user.uid);
      }
      setSelectedUserIds(newSet);
    }
  };


  const handleSave = () => {
    const newAssignedUsers = Array.from(selectedUserIds).map(userId => {
        const user = allUsers.find(u => u.uid === userId);
        return { userId, userName: user?.displayName || 'Unknown' };
    });
    onSave(shift.id, newAssignedUsers);
    onClose();
  };
  
  const UserCard = ({user, isAvailable}: {user: ManagedUser, isAvailable: boolean}) => {
    const isSelected = selectedUserIds.has(user.uid);
    const conflict = hasTimeConflict(user.uid, shift, allShiftsOnDay);
    const canSelect = currentUserRole === 'Chủ nhà hàng' || isAvailable;
    
    return (
      <Card 
        className={cn(
            "cursor-pointer transition-all",
            isSelected ? 'border-primary ring-2 ring-primary' : 'hover:border-primary/50',
            !canSelect && !isSelected && 'opacity-60 bg-muted/50 cursor-not-allowed'
        )}
        onClick={() => handleSelectUser(user)}
      >
        <CardContent className="p-3 flex items-center justify-between gap-3">
          <div className="flex-1 space-y-1">
            <p className="font-semibold">{user.displayName}</p>
            <p className="text-xs text-muted-foreground">{user.role}</p>
          </div>
           <div className="flex flex-col items-end gap-1">
             {isSelected ? (
                <>
                    <CheckCircle className="h-5 w-5 text-primary" />
                    {!isAvailable && <Badge variant="destructive" className="bg-yellow-500 text-yellow-900 text-xs">Chọn dù bận</Badge>}
                </>
             ) : (
                conflict ? <Badge variant="destructive" className="bg-yellow-500 text-yellow-900 text-xs">Trùng ca</Badge> : (!isAvailable && <Badge variant="outline" className="text-xs">Bận</Badge>)
             )}
           </div>
        </CardContent>
      </Card>
    );
  }

  return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>{isPassAssignmentMode ? 'Chỉ định ca thay thế' : `Phân công: ${shift.label}`}</DialogTitle>
                <DialogDescription>
                    {format(parseISO(shift.date), 'eeee, dd/MM/yyyy', { locale: vi })} | {shift.timeSlot.start} - {shift.timeSlot.end}
                     {isPassAssignmentMode && ` cho ${passRequestingUser?.userName}`}
                </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[50vh] pr-4">
                <div className="space-y-4">
                    {sortedUsers.availableUsers.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold mb-2">Nhân viên rảnh</h4>
                            <div className="space-y-2">
                                {sortedUsers.availableUsers.map(user => <UserCard key={user.uid} user={user} isAvailable={true} />)}
                            </div>
                        </div>
                    )}
                     {sortedUsers.busyUsers.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold mb-2">Nhân viên bận hoặc chưa đăng ký</h4>
                            <div className="space-y-2">
                                {sortedUsers.busyUsers.map(user => <UserCard key={user.uid} user={user} isAvailable={false} />)}
                            </div>
                        </div>
                    )}
                    {sortedUsers.availableUsers.length === 0 && sortedUsers.busyUsers.length === 0 && (
                        <p className="text-sm text-center text-muted-foreground py-8">Không có nhân viên nào phù hợp để chỉ định.</p>
                    )}
                </div>
            </ScrollArea>
            <DialogFooter>
                <Button variant="outline" onClick={onClose}>Hủy</Button>
                <Button onClick={handleSave}>Lưu thay đổi</Button>
            </DialogFooter>

             <AlertDialog open={!!conflictError} onOpenChange={() => setConflictError(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2"><AlertCircle className="text-destructive"/>Lỗi: Phân công bị trùng</AlertDialogTitle>
                        <AlertDialogDescription>
                            Nhân viên <span className="font-bold">{conflictError?.userName}</span> đã được xếp vào ca <span className="font-bold">{conflictError?.shiftLabel}</span>, bị trùng giờ với ca này.
                             <br/><br/>
                            Vui lòng bỏ phân công ở ca đó trước khi thêm vào ca này.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setConflictError(null)}>Đã hiểu</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </DialogContent>
      </Dialog>
  );
}
