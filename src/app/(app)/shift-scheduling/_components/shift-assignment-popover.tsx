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
import { User, CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import type { AssignedShift, Availability, ManagedUser, UserRole, AssignedUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import { isUserAvailable, hasTimeConflict } from '@/lib/schedule-utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Combobox } from '@/components/combobox';
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
import { toast } from '@/components/ui/pro-toast';

type ShiftAssignmentDialogProps = {
  shift: AssignedShift;
  allUsers: ManagedUser[];
  currentUserRole: UserRole;
  currentUserName: string;
  availability: Availability[];
  // newAssignedUsers may include an assignedRole when set by Owner
  onSave: (shiftId: string, newAssignedUsers: { userId: string; userName: string; assignedRole: UserRole }[]) => void;
  isOpen: boolean;
  onClose: () => void;
  allShiftsOnDay: AssignedShift[];
  passRequestingUser?: AssignedUser | null;
};

const roleOrder: Record<UserRole, number> = {
    'Phục vụ': 1,
    'Pha chế': 2,
    'Thu ngân': 3,
    'Quản lý': 4,
    'Chủ nhà hàng': 5,
};

const getRoleTextColor = (role: UserRole): string => {
    switch (role) {
        case 'Phục vụ': return 'text-blue-800 dark:text-blue-300';
        case 'Pha chế': return 'text-green-800 dark:text-green-300';
        case 'Thu ngân': return 'text-orange-800 dark:text-orange-300';
        case 'Quản lý': return 'text-purple-800 dark:text-purple-300';
        default: return 'text-muted-foreground';
    }
};

export default function ShiftAssignmentDialog({
  shift,
  allUsers,
  currentUserRole,
  currentUserName,
  availability,
  onSave,
  isOpen,
  onClose,
  allShiftsOnDay,
  passRequestingUser,
}: ShiftAssignmentDialogProps) {
    
  const isPassAssignmentMode = !!passRequestingUser;
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Record<string, UserRole>>({});
  const [conflictError, setConflictError] = useState<{ userName: string; shiftLabel: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (isPassAssignmentMode) {
        // In pass assignment mode, selection is cleared initially.
        setSelectedUserIds(new Set());
        setSelectedRoles({});
      } else {
        setSelectedUserIds(new Set(shift.assignedUsers.map(u => u.userId)));
        // Initialize roles from existing assignedUsersWithRole if present
        const initRoles: Record<string, UserRole> = {};
        (shift.assignedUsers || []).forEach(u => {
          initRoles[u.userId] = u.assignedRole;
        });
        setSelectedRoles(initRoles);
      }
      setConflictError(null);
    }
  }, [isOpen, shift.assignedUsers, isPassAssignmentMode]);

  const { selectedUsers, availableUsers, busyUsers } = useMemo(() => {
    const shiftRole = shift.role;
    
    let roleFilteredUsers: ManagedUser[];

    if (currentUserRole === 'Quản lý' && !currentUserName.includes('Không chọn')) {
      roleFilteredUsers = allUsers.filter(user => 
        user.role !== 'Chủ nhà hàng' && !user.displayName.includes('Không chọn')
      );
    } else {
        roleFilteredUsers = allUsers;
    }

    // Further filter by the role required for the shift
    roleFilteredUsers = roleFilteredUsers.filter(user => shiftRole === 'Bất kỳ' || user.role === shiftRole || user.secondaryRoles?.includes(shiftRole));

    // In pass assignment mode, filter out the user who is making the request
    if (isPassAssignmentMode && passRequestingUser) {
        roleFilteredUsers = roleFilteredUsers.filter(user => user.uid !== passRequestingUser.userId);
    }
    
    const selectedList: ManagedUser[] = [];
    const availableList: ManagedUser[] = [];
    const busyList: ManagedUser[] = [];

    roleFilteredUsers.forEach(user => {
      if (selectedUserIds.has(user.uid)) {
        selectedList.push(user);
      } else if (isUserAvailable(user.uid, shift.timeSlot, availability.filter(a => a.date === shift.date))) {
        availableList.push(user);
      } else {
        busyList.push(user);
      }
    });

    const sortFn = (a: ManagedUser, b: ManagedUser) => {
        const roleComparison = (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
        if (roleComparison !== 0) return roleComparison;
        return a.displayName.localeCompare(b.displayName, 'vi');
    };

    selectedList.sort(sortFn);
    availableList.sort(sortFn);
    busyList.sort(sortFn);

    return { selectedUsers: selectedList, availableUsers: availableList, busyUsers: busyList };
  }, [allUsers, shift.role, shift.timeSlot, availability, isPassAssignmentMode, passRequestingUser, currentUserRole, selectedUserIds]);
  
  const handleSelectUser = (user: ManagedUser) => {
    // Prevent manager from selecting busy users. Only owner can.
    const isAvailable = isUserAvailable(user.uid, shift.timeSlot, availability.filter(a => a.date === shift.date));
    if (currentUserRole === 'Quản lý' && !isAvailable) {
        toast.error("Nhân viên này không đăng ký rảnh. Chỉ Chủ nhà hàng mới có thể xếp.");
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
        // Initialize role for this selection
        setSelectedRoles(prev => ({ ...prev, [user.uid]: (shift.assignedUsers || []).find(u => u.userId === user.uid)?.assignedRole ?? user.role }));
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
        // Initialize role for this selection
        setSelectedRoles(prev => ({ ...prev, [user.uid]: (shift.assignedUsers || []).find(u => u.userId === user.uid)?.assignedRole ?? user.role }));
      }
      setSelectedUserIds(newSet);
    }
  };


  const handleSave = () => {
    const newAssignedUsers : AssignedUser[] = Array.from(selectedUserIds).map(userId => {
        const user = allUsers.find(u => u.uid === userId);
        return { userId, userName: user?.displayName || 'Unknown', assignedRole: selectedRoles[userId] };
    });
    onSave(shift.id, newAssignedUsers);
    onClose();
  };
  
  const UserCard = ({user, isAvailable}: {user: ManagedUser, isAvailable: boolean}) => {
    const isSelected = selectedUserIds.has(user.uid);
    const conflict = hasTimeConflict(user.uid, shift, allShiftsOnDay.filter(s => s.id !== shift.id));
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
            <p className={cn("text-xs", getRoleTextColor(user.role))}>{user.role}</p>
            {isSelected && currentUserRole === 'Chủ nhà hàng' && (
              <div className="mt-1">
                {/* Use only user's main + secondary roles as options */}
                {((user.secondaryRoles?.filter(r => r !== 'Thu ngân') || []).length || 0) > 0 ? (
                  (() => {
                    const roleOptions: (UserRole)[] = Array.from(new Set([user.role, ...(user.secondaryRoles?.filter(r => r !== 'Thu ngân') || [])]));
                    const selectedValue = selectedRoles[user.uid] ?? (shift.assignedUsers?.find(u => u.userId === user.uid)?.assignedRole ?? user.role);
                    return (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Combobox
                          value={selectedValue}
                          onChange={(v) => setSelectedRoles(prev => ({ ...prev, [user.uid]: v as UserRole }))}
                          options={roleOptions.map(r => ({ value: r, label: r }))}
                          compact
                          searchable={false}
                          className="h-7 w-36 text-xs"
                          placeholder="Vai trò"
                        />
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-xs text-muted-foreground">Vai trò: <span className="font-medium">{user.role}</span></div>
                )}
              </div>
            )}
          </div>
           <div className="flex flex-col items-end gap-1">
             {isSelected ? (
                <>
                    <CheckCircle className="h-5 w-5 text-primary" />
                    {!isAvailable && <Badge variant="destructive" className="bg-yellow-500 text-yellow-900 text-xs">Chọn dù bận</Badge>}
                </>
             ) : (
                conflict 
                    ? <Badge variant="destructive" className="bg-yellow-500 text-yellow-900 text-xs">Trùng ca</Badge> 
                    : (!isAvailable && <Badge variant="destructive" className="bg-yellow-500 text-yellow-900 text-xs">Bận</Badge>)
             )}
           </div>
        </CardContent>
      </Card>
    );
  }

  const SectionHeader = ({ title }: { title: string }) => (
    <h4 className="text-sm font-semibold mb-2 sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2 -mt-2">
      {title}
    </h4>
  );

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
            <ScrollArea className="max-h-[50vh] -mx-4 px-2">
                <div className="space-y-4 px-2 pb-4">
                    {selectedUsers.length > 0 && (
                        <div>
                            <SectionHeader title={`Nhân viên trong ca (${selectedUsers.length})`} />
                            <div className="space-y-2">
                                {selectedUsers.map(user => <UserCard key={user.uid} user={user} isAvailable={isUserAvailable(user.uid, shift.timeSlot, availability.filter(a => a.date === shift.date))} />)}
                            </div>
                        </div>
                    )}
                    {availableUsers.length > 0 && (
                        <div>
                            <SectionHeader title={`Nhân viên rảnh (${availableUsers.length})`} />
                            <div className="space-y-2">
                                {availableUsers.map(user => <UserCard key={user.uid} user={user} isAvailable={true} />)}
                            </div>
                        </div>
                    )}
                     {busyUsers.length > 0 && (
                        <div>
                            <SectionHeader title={`Nhân viên bận hoặc chưa đăng ký (${busyUsers.length})`} />
                            <div className="space-y-2">
                                {busyUsers.map(user => <UserCard key={user.uid} user={user} isAvailable={false} />)}
                            </div>
                        </div>
                    )}
                    {selectedUsers.length === 0 && availableUsers.length === 0 && busyUsers.length === 0 && (
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
