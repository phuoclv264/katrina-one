'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
  DialogAction,
  DialogCancel,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, CheckCircle, AlertTriangle, AlertCircle, Clock } from 'lucide-react';
import type { AssignedShift, Availability, ManagedUser, UserRole, AssignedUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import { isUserAvailable, hasTimeConflict, calculateTotalHours } from '@/lib/schedule-utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Combobox } from '@/components/combobox';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogIcon,
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
  weekInterval: { start: Date; end: Date };
  weekShifts: AssignedShift[];
  parentDialogTag: string;
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

const formatHours = (value: number): string => {
  const normalized = Math.round(value * 10) / 10;
  if (normalized === 0) return '0h';
  return Number.isInteger(normalized) ? `${normalized}h` : `${normalized.toFixed(1)}h`;
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
  weekInterval,
  weekShifts,
  parentDialogTag
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

  const assignedHoursByUser = useMemo(() => {
    const map = new Map<string, number>();
    if (!weekShifts.length) return map;
    const interval = { start: weekInterval.start, end: weekInterval.end };
    for (const weekShift of weekShifts) {
      const shiftDate = parseISO(weekShift.date);
      if (!isWithinInterval(shiftDate, interval)) continue;
      const duration = calculateTotalHours([weekShift.timeSlot]);
      const assignees = weekShift.assignedUsersWithRole ?? weekShift.assignedUsers;
      for (const assignedUser of assignees) {
        map.set(assignedUser.userId, (map.get(assignedUser.userId) || 0) + duration);
      }
    }
    return map;
  }, [weekInterval.start, weekInterval.end, weekShifts]);

  const availabilityHoursByUser = useMemo(() => {
    const map = new Map<string, number>();
    const interval = { start: weekInterval.start, end: weekInterval.end };
    for (const record of availability) {
      const recordDate = typeof record.date === 'string' ? parseISO(record.date) : record.date.toDate();
      if (!isWithinInterval(recordDate, interval)) continue;
      const total = calculateTotalHours(record.availableSlots);
      if (total <= 0) continue;
      map.set(record.userId, (map.get(record.userId) || 0) + total);
    }
    return map;
  }, [availability, weekInterval.start, weekInterval.end]);

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
    const newAssignedUsers: AssignedUser[] = Array.from(selectedUserIds).map(userId => {
      const user = allUsers.find(u => u.uid === userId);
      return { userId, userName: user?.displayName || 'Unknown', assignedRole: selectedRoles[userId] };
    });
    onSave(shift.id, newAssignedUsers);
    onClose();
  };

  const UserCard = ({ user, isAvailable }: { user: ManagedUser, isAvailable: boolean }) => {
    const isSelected = selectedUserIds.has(user.uid);
    const conflict = hasTimeConflict(user.uid, shift, allShiftsOnDay.filter(s => s.id !== shift.id));
    const canSelect = currentUserRole === 'Chủ nhà hàng' || isAvailable;
    const assignedHours = assignedHoursByUser.get(user.uid) ?? 0;
    const availableHours = availabilityHoursByUser.get(user.uid) ?? 0;

    return (
      <Card
        className={cn(
          "cursor-pointer transition-all border-none shadow-none transform-gpu transition-transform",
          isSelected 
            ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background scale-105 z-10 mb-3' 
            : 'bg-muted/30 hover:bg-muted/50 text-foreground',
          !canSelect && !isSelected && 'opacity-60 bg-muted/20 cursor-not-allowed'
        )}
        onClick={() => handleSelectUser(user)}
      >
        <CardContent className={cn(isSelected ? 'p-5' : 'p-4', 'flex items-center justify-between gap-3')}>
          <div className="flex-1 space-y-1">
            <p className="font-bold">{user.displayName}</p>
            <p className={cn("text-xs font-medium opacity-80", isSelected ? 'text-primary-foreground' : getRoleTextColor(user.role))}>{user.role}</p>
            <p className="text-[11px] leading-tight text-white-foreground/80">
              Đã xếp: {formatHours(assignedHours)} · Đăng ký: {formatHours(availableHours)}
            </p>
            {isSelected && currentUserRole === 'Chủ nhà hàng' && (
              <div className="mt-2 pt-2 border-t border-primary-foreground/20">
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
                          className={cn(
                            "h-8 w-40 text-xs font-semibold",
                            isSelected ? "bg-primary-foreground/10 border-primary-foreground/20 text-white" : ""
                          )}
                          placeholder="Vai trò"
                        />
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-xs opacity-90">Vai trò: <span className="font-bold">{user.role}</span></div>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {isSelected ? (
              <>
                <div className="bg-primary-foreground/20 p-1 rounded-full">
                  <CheckCircle className="h-5 w-5 text-white" />
                </div>
                {!isAvailable && <Badge variant="destructive" className="bg-yellow-400 text-yellow-950 border-none text-[10px] uppercase font-black px-1.5 py-0">Chọn dù bận</Badge>}
              </>
            ) : (
              conflict
                ? <Badge variant="destructive" className="bg-rose-500 text-white border-none text-[10px] uppercase font-black px-1.5 py-0 shadow-sm">Trùng ca</Badge>
                : (!isAvailable && <Badge variant="destructive" className="bg-sky-500 text-white border-none text-[10px] uppercase font-black px-1.5 py-0 shadow-sm">Bận</Badge>)
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const SectionHeader = ({ title, count }: { title: string, count: number }) => (
    <div className="flex items-center justify-between mb-3 px-1 sticky top-0 bg-background/95 backdrop-blur-sm z-20 py-1">
      <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">
        {title}
      </h4>
      <Badge variant="outline" className="rounded-full px-2 py-0 h-5 text-[10px] border-muted-foreground/20 font-bold bg-muted/5">
        {count}
      </Badge>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="shift-assignment-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-md">
        <DialogHeader iconkey="user" variant="premium">
          <DialogTitle>{isPassAssignmentMode ? 'Chỉ định ca thay thế' : `Phân công: ${shift.label}`}</DialogTitle>
          <DialogDescription>
            {format(parseISO(shift.date), 'eeee, dd/MM/yyyy', { locale: vi })}
            <span className="flex items-center gap-1.5 mt-1 text-primary font-bold">
              <Clock className="w-3.5 h-3.5" />
              {shift.timeSlot.start} - {shift.timeSlot.end}
            </span>
            {isPassAssignmentMode && (
              <span className="mt-2 text-xs font-medium bg-primary/5 text-primary-foreground border border-primary/10 rounded-full px-3 py-1 inline-flex items-center gap-1">
                Thay thế cho: <span className="font-bold">{passRequestingUser?.userName}</span>
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="bg-slate-50/50 dark:bg-zinc-950/50">
          <div className="space-y-8 py-2">
            {selectedUsers.length > 0 && (
              <div>
                <SectionHeader title="Nhân viên trong ca" count={selectedUsers.length} />
                <div className="grid gap-2">
                  {selectedUsers.map(user => (
                    <UserCard 
                      key={user.uid} 
                      user={user} 
                      isAvailable={isUserAvailable(user.uid, shift.timeSlot, availability.filter(a => a.date === shift.date))} 
                    />
                  ))}
                </div>
              </div>
            )}
            
            {availableUsers.length > 0 && (
              <div>
                <SectionHeader title="Nhân viên rảnh" count={availableUsers.length} />
                <div className="grid gap-2">
                  {availableUsers.map(user => (
                    <UserCard 
                      key={user.uid} 
                      user={user} 
                      isAvailable={true} 
                    />
                  ))}
                </div>
              </div>
            )}

            {busyUsers.length > 0 && (
              <div>
                <SectionHeader title="Nhân viên bận/Chưa đăng ký" count={busyUsers.length} />
                <div className="grid gap-2">
                  {busyUsers.map(user => (
                    <UserCard 
                      key={user.uid} 
                      user={user} 
                      isAvailable={false} 
                    />
                  ))}
                </div>
              </div>
            )}

            {selectedUsers.length === 0 && availableUsers.length === 0 && busyUsers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <User className="w-12 h-12 mb-3 opacity-20" />
                <p className="text-sm font-medium">Không có nhân viên nào phù hợp.</p>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogCancel>Hủy</DialogCancel>
          <DialogAction onClick={handleSave}>Lưu thay đổi</DialogAction>
        </DialogFooter>

        <AlertDialog open={!!conflictError} onOpenChange={() => setConflictError(null)} dialogTag="alert-dialog" parentDialogTag="shift-assignment-dialog" variant="destructive">
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="space-y-2 text-center sm:text-left">
                <AlertDialogTitle>Lỗi: Phân công bị trùng</AlertDialogTitle>
                <AlertDialogDescription>
                  Nhân viên <span className="font-bold text-foreground">{conflictError?.userName}</span> đã được xếp vào ca <span className="font-bold text-foreground">{conflictError?.shiftLabel}</span>, bị trùng giờ với ca này.
                  <br /><br />
                  Vui lòng bỏ phân công ở ca đó trước khi thêm vào ca này.
                </AlertDialogDescription>
              </div>
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
