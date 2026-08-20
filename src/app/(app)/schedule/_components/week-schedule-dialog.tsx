'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogAction } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ChevronLeft, ChevronRight, Calendar as CalendarIcon, UserPlus, Loader2 } from 'lucide-react';
import type { AssignedShift, ManagedUser, Schedule, ShiftBusyEvidence, ShiftTemplate, UserRole, BusyReportRequest } from '@/lib/types';
import { subscribeToBusyReportRequestsForWeek } from '@/lib/schedule-store';
import type { AuthUser } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { addWeeks, eachDayOfInterval, endOfWeek, format, getISOWeek, getISOWeekYear, startOfWeek } from 'date-fns';
import { vi } from 'date-fns/locale';
import { getRelevantUnderstaffedShifts, getShiftMissingDetails } from '../../shift-scheduling/_components/understaffed-evidence-utils';
import { dataStore } from '@/lib/data-store';
import { toast } from '@/components/ui/pro-toast';

interface WeekScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: Schedule | null;
  allUsers: ManagedUser[];
  shiftTemplates: ShiftTemplate[];
  initialWeekInterval: { start: Date; end: Date };
  onWeekChange: (weekId: string) => void;
  currentUser?: AuthUser | null;
  evidences?: ShiftBusyEvidence[];
  onOpenBusyEvidence?: (relevantShifts: AssignedShift[]) => void;
  parentDialogTag: string;
}

const roleOrder: Record<UserRole, number> = {
  'Phục vụ': 1,
  'Pha chế': 2,
  'Thu ngân': 3,
  'Quản lý': 4,
  'Chủ nhà hàng': 5,
};

const getRoleColor = (role: UserRole | 'Bất kỳ'): string => {
  switch (role) {
    case 'Phục vụ':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700';
    case 'Pha chế':
      return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700';
    case 'Thu ngân':
      return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-700';
    case 'Quản lý':
      return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-700';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600';
  }
};

const statusLabel: Record<Schedule['status'], string> = {
  draft: 'Bản nháp',
  proposed: 'Chờ duyệt',
  published: 'Đã công bố',
};

const timeToMinutes = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);
  return (hour || 0) * 60 + (minute || 0);
};

const getShiftTimeFrame = (shift: AssignedShift): 'morning' | 'afternoon' | 'evening' => {
  const startMinutes = timeToMinutes(shift.timeSlot.start);
  if (startMinutes < 12 * 60) return 'morning';
  if (startMinutes < 17 * 60) return 'afternoon';
  return 'evening';
};

const timeFrameClasses: Record<'morning' | 'afternoon' | 'evening', string> = {
  morning: 'border-l-[4px] border-amber-500 bg-amber-50/40 dark:bg-amber-900/10',
  afternoon: 'border-l-[4px] border-sky-500 bg-sky-50/40 dark:bg-sky-900/10',
  evening: 'border-l-[4px] border-rose-500 bg-rose-50/40 dark:bg-rose-900/10',
};

export default function WeekScheduleDialog({
  open,
  onOpenChange,
  schedule,
  allUsers,
  initialWeekInterval,
  onWeekChange,
  currentUser,
  evidences = [],
  onOpenBusyEvidence,
  parentDialogTag
}: WeekScheduleDialogProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekInterval, setWeekInterval] = useState(initialWeekInterval);
  const [selectedDateStr, setSelectedDateStr] = useState<string>('');

  useEffect(() => {
    if (open) {
      setWeekOffset(0);
    }
  }, [open]);

  useEffect(() => {
    const newStart = addWeeks(initialWeekInterval.start, weekOffset);
    const start = startOfWeek(newStart, { weekStartsOn: 1 });
    const end = endOfWeek(newStart, { weekStartsOn: 1 });
    const id = `${getISOWeekYear(newStart)}-W${getISOWeek(newStart)}`;
    setWeekInterval({ start, end });
    onWeekChange(id);
  }, [initialWeekInterval.start, weekOffset, onWeekChange]);

  const daysOfWeek = useMemo(
    () => eachDayOfInterval({ start: weekInterval.start, end: weekInterval.end }),
    [weekInterval]
  );

  useEffect(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayInWeek = daysOfWeek.find(d => format(d, 'yyyy-MM-dd') === todayStr);
    setSelectedDateStr(todayInWeek ? todayStr : format(daysOfWeek[0], 'yyyy-MM-dd'));
  }, [daysOfWeek]);

  const hasSchedule = !!schedule && schedule.status === 'published' && schedule.shifts.length > 0;

  const relevantUnderstaffedShifts = useMemo<AssignedShift[]>(() => {
    return getRelevantUnderstaffedShifts(schedule, allUsers, { currentUser, roleAware: true });
  }, [schedule, currentUser, allUsers]);

  const weekIdForDialog = useMemo(() => {
    return `${getISOWeekYear(weekInterval.start)}-W${getISOWeek(weekInterval.start)}`;
  }, [weekInterval]);

  const [busyRequests, setBusyRequests] = useState<BusyReportRequest[]>([]);
  useEffect(() => {
    if (!weekIdForDialog || !open) return;
    const unsub = subscribeToBusyReportRequestsForWeek(weekIdForDialog, setBusyRequests);
    return () => unsub();
  }, [weekIdForDialog, open]);

  const targetedShiftIds = useMemo(() => {
    if (!currentUser) return new Set<string>();
    const ids = busyRequests
      .filter(r => r.active && (
        r.targetMode === 'all' ||
        (r.targetMode === 'roles' && (r.targetRoles || []).includes(currentUser.role)) ||
        (r.targetMode === 'users' && (r.targetUserIds || []).includes(currentUser.uid))
      ))
      .map(r => r.shiftId);
    return new Set(ids);
  }, [busyRequests, currentUser]);

  const relevantTargetedShifts = useMemo<AssignedShift[]>(() => {
    const list = schedule?.shifts || [];
    return list.filter(s => targetedShiftIds.has(s.id));
  }, [schedule, targetedShiftIds]);

  const pendingEvidenceCount = useMemo(() => {
    if (!currentUser) return 0;
    return relevantTargetedShifts.reduce((count, shift) => {
      const submitted = evidences.some((entry) => entry.shiftId === shift.id && entry.submittedBy.userId === currentUser.uid);
      return submitted ? count : count + 1;
    }, 0);
  }, [relevantTargetedShifts, evidences, currentUser]);

  const totalRelevantShifts = relevantTargetedShifts.length;
  const submittedEvidenceCount = Math.max(0, totalRelevantShifts - pendingEvidenceCount);

  const [processingShiftId, setProcessingShiftId] = useState<string | null>(null);
  const [localAppliedShiftIds, setLocalAppliedShiftIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLocalAppliedShiftIds({});
  }, [schedule?.weekId, currentUser?.uid]);

  const handleApply = async (shiftId: string) => {
    if (!currentUser || !schedule) return;
    const previousApplied = localAppliedShiftIds[shiftId] ?? false;
    setLocalAppliedShiftIds((prev) => ({ ...prev, [shiftId]: true }));
    setProcessingShiftId(shiftId);
    try {
      await dataStore.applyForShift(schedule.weekId, shiftId, currentUser);
      toast.success("Đã gửi yêu cầu nhận ca.");
    } catch (e: any) {
      setLocalAppliedShiftIds((prev) => ({ ...prev, [shiftId]: previousApplied }));
      toast.error(e.message);
    } finally {
      setProcessingShiftId(null);
    }
  }

  const handleCancelApplication = async (shiftId: string) => {
    if (!currentUser || !schedule) return;
    const previousApplied = localAppliedShiftIds[shiftId] ?? true;
    setLocalAppliedShiftIds((prev) => ({ ...prev, [shiftId]: false }));
    setProcessingShiftId(shiftId);
    try {
      await dataStore.cancelShiftApplication(schedule.weekId, shiftId, currentUser.uid);
      toast.success("Đã hủy yêu cầu.");
    } catch (e: any) {
      setLocalAppliedShiftIds((prev) => ({ ...prev, [shiftId]: previousApplied }));
      toast.error(e.message);
    } finally {
      setProcessingShiftId(null);
    }
  }

  const renderShiftItem = (shift: AssignedShift) => {
    const sortedUsers = [...shift.assignedUsers]
      .map((assignedUser) => ({
        assignedUser,
        user: allUsers.find((u) => u.uid === assignedUser.userId),
      }))
      .sort((a, b) => {
        const userA = a.user;
        const userB = b.user;
        if (!userA || !userB) return 0;
        return (roleOrder[userA.role] || 99) - (roleOrder[userB.role] || 99);
      });

    const isUnderstaffed =
      ((shift.minUsers || 0) > 0 && shift.assignedUsers.length < shift.minUsers) ||
      ((shift.requiredRoles || []).some(req => {
        const assignedOfRole = shift.assignedUsers.filter(au => {
          const user = allUsers.find(u => u.uid === au.userId);
          const effRole = au.assignedRole ?? user?.role;
          return effRole === req.role;
        }).length;
        return assignedOfRole < req.count;
      }));

    const isRelevantToMe = relevantUnderstaffedShifts.some(s => s.id === shift.id);
    const remoteHasApplied = currentUser ? shift.applicants?.some(a => a.userId === currentUser.uid) : false;
    const localHasApplied = currentUser ? localAppliedShiftIds[shift.id] : undefined;
    const hasApplied = localHasApplied !== undefined ? localHasApplied : remoteHasApplied;
    const isProcessing = processingShiftId === shift.id;
    const missing = getShiftMissingDetails(shift, allUsers);
    const shiftTimeFrame = getShiftTimeFrame(shift);

    return (
      <div 
        key={shift.id} 
        className={cn(
          "py-2 pl-3 flex flex-col gap-1.5 sm:px-4",
          timeFrameClasses[shiftTimeFrame],
          isRelevantToMe ? "bg-amber-50/50 dark:bg-amber-900/15" : ""
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Shift Title and Time (Simplified inline format) */}
            <div className="text-[14px] font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {shift.label} <span className="font-normal text-muted-foreground whitespace-nowrap">({shift.timeSlot.start} - {shift.timeSlot.end})</span>
            </div>
            
            {/* Assigned Users list */}
            <div className="flex flex-wrap items-center gap-1">
              {sortedUsers.length > 0 ? (
                sortedUsers.map(({ assignedUser, user }) => (
                  <Badge
                    key={assignedUser.userId}
                    className={cn('text-[11px] font-medium h-5 py-0 px-2 border', getRoleColor(user?.role ?? 'Bất kỳ'))}
                  >
                    {user?.displayName ?? assignedUser.userId}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground italic">Trống</span>
              )}
            </div>
          </div>

          {/* Action Buttons (Apply / Cancel / Missing Alert) */}
          {((isUnderstaffed && currentUser) || isUnderstaffed) && (
            <div className="flex flex-col items-end gap-2 shrink-0 mt-0.5">
              {isUnderstaffed && (
                <div className={cn(
                  'h-6 rounded-md px-2 text-[11px] font-semibold inline-flex items-center gap-1',
                  isRelevantToMe ? 'bg-amber-100 text-amber-700' : 'bg-destructive/10 text-destructive'
                )}>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>{missing.text ?? 'Thiếu'}</span>
                </div>
              )}
              {currentUser && isUnderstaffed && (
                hasApplied ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCancelApplication(shift.id)}
                    disabled={isProcessing}
                    className="h-8 rounded-md px-3 text-[11px] font-semibold border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300"
                  >
                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Hủy đăng ký'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleApply(shift.id)}
                    disabled={isProcessing}
                    className="h-8 rounded-md px-3 text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary hover:text-white"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                        Đăng ký
                      </>
                    )}
                  </Button>
                )
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    if (!hasSchedule || !schedule) return null;

    const selectedDateShifts = schedule.shifts
      .filter(s => s.date === selectedDateStr)
      .sort((a, b) => a.timeSlot.start.localeCompare(b.timeSlot.start));
    
    if (selectedDateShifts.length === 0) {
      return (
        <div className="p-12 text-center flex flex-col items-center justify-center h-full">
           <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
             <CalendarIcon className="h-8 w-8 text-slate-400" />
           </div>
           <h3 className="font-semibold text-lg mb-1">Không có ca làm việc</h3>
           <p className="text-sm text-muted-foreground">Không có lịch trình nào được sắp xếp cho ngày này.</p>
        </div>
      );
    }

    return (
      <div className="px-3 pb-8 flex flex-col max-w-4xl mx-auto w-full">
        {selectedDateShifts.map(renderShiftItem)}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dialogTag="week-schedule-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-4xl lg:min-w-[70vw] p-0 overflow-hidden flex flex-col border-none sm:rounded-2xl h-[100dvh] sm:h-[85vh] sm:max-h-[90vh]">
        <DialogHeader iconkey="calendar" className="shrink-0">
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex flex-col">
              <DialogTitle>Lịch làm việc tuần</DialogTitle>
              {schedule && (
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={schedule.status === 'published' ? 'default' : 'secondary'} className="px-2 py-0 rounded-full text-[10px] uppercase font-bold tracking-wider">
                    {statusLabel[schedule.status]}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="p-0 flex flex-1 flex-col min-h-0 bg-slate-50/30 dark:bg-transparent overflow-hidden">
          {/* Action Header & Navigation */}
          <div className="px-3 sm:px-4 py-2 border-b bg-background sticky top-0 z-20 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center justify-between sm:justify-start gap-3 order-2 sm:order-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-xl border-slate-200 hover:bg-slate-50 shrink-0"
                  onClick={() => setWeekOffset((prev) => prev - 1)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                <div className="flex flex-col items-center sm:items-start text-center sm:text-left min-w-[140px]">
                  <span className="text-sm font-bold text-foreground">
                    {format(weekInterval.start, 'dd/MM')} — {format(weekInterval.end, 'dd/MM/yyyy')}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <CalendarIcon className="h-3 w-3 text-primary" />
                    {weekOffset !== 0 ? (
                      <button
                        onClick={() => setWeekOffset(0)}
                        className="text-[10px] font-bold text-primary hover:underline uppercase"
                      >
                        Hiện tại
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">Tuần này</span>
                    )}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-xl border-slate-200 hover:bg-slate-50 shrink-0"
                  onClick={() => setWeekOffset((prev) => prev + 1)}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              {currentUser && totalRelevantShifts > 0 && onOpenBusyEvidence && (
                <div className="flex items-center gap-2 order-1 sm:order-2">
                  <div className={cn(
                    "flex flex-1 items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all duration-300",
                    pendingEvidenceCount > 0
                      ? "bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/40"
                      : "bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-900/40"
                  )}>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] sm:text-xs font-bold whitespace-nowrap">
                          {submittedEvidenceCount}/{totalRelevantShifts} ca báo bận
                        </span>
                      </div>
                      <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                        <div
                          className={cn("h-full transition-all duration-500", pendingEvidenceCount > 0 ? "bg-amber-500" : "bg-emerald-500")}
                          style={{ width: `${(submittedEvidenceCount / totalRelevantShifts) * 100}%` }}
                        />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={pendingEvidenceCount > 0 ? 'default' : 'secondary'}
                      className={cn(
                        "h-8 px-3 text-[11px] font-bold rounded-lg shrink-0",
                        pendingEvidenceCount > 0 ? "shadow-md shadow-primary/20" : ""
                      )}
                      onClick={() => onOpenBusyEvidence && onOpenBusyEvidence(relevantTargetedShifts)}
                    >
                      {pendingEvidenceCount > 0
                        ? `Báo bận (${pendingEvidenceCount})`
                        : 'Xem đã gửi'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
            {hasSchedule ? (
              <div className="flex flex-col flex-1 min-h-0 bg-background">
                {/* Date Selector Strip (stays fixed) */}
                <div className="grid w-full grid-cols-7 gap-1 p-1 sm:gap-1.5 sm:p-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
                  {daysOfWeek.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const isSelected = dateKey === selectedDateStr;
                    const isToday = dateKey === format(new Date(), 'yyyy-MM-dd');

                    return (
                      <button
                        key={dateKey}
                        onClick={() => setSelectedDateStr(dateKey)}
                        className={cn(
                          "flex w-full flex-col items-center justify-center h-[52px] rounded-lg border transition-colors min-w-0 sm:h-[62px]",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : isToday
                              ? "bg-primary/5 border-primary/20 text-foreground"
                              : "bg-card text-muted-foreground border-border hover:bg-accent/50"
                        )}
                      >
                        <span className={cn("text-[8px] sm:text-[10px] uppercase tracking-wider font-semibold mb-0.5", isSelected ? "text-primary-foreground/80" : "")}>
                          {format(day, 'eee', { locale: vi })}
                        </span>
                        <span className="text-base font-bold leading-none sm:text-lg">
                          {format(day, 'dd')}
                        </span>
                      </button>
                    );
                  })}
                </div>
                
                {/* Selected Day Shifts List */}
                <div className="flex-1 overflow-y-auto min-h-0 sm:pt-4">
                  {renderDayView()}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-4 overflow-y-auto bg-background">
                <div className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-6 sm:p-8 text-center bg-white/50 dark:bg-black/10 w-full max-w-md">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center mb-3">
                    <ChevronRight className="h-7 w-7 text-muted-foreground/40 rotate-45" />
                  </div>
                  <h3 className="font-bold text-lg mb-1">Chưa có lịch làm việc</h3>
                  <p className="text-sm text-muted-foreground">Vui lòng chọn tuần khác hoặc chờ quản lý công bố lịch.</p>
                </div>
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="border-t bg-background shrink-0">
          <DialogAction variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Đóng
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}