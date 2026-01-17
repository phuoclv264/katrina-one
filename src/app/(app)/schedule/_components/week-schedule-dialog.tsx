'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AssignedShift, ManagedUser, Schedule, ShiftBusyEvidence, ShiftTemplate, UserRole, BusyReportRequest } from '@/lib/types';
import { subscribeToBusyReportRequestsForWeek } from '@/lib/schedule-store';
import type { AuthUser } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { addWeeks, eachDayOfInterval, endOfWeek, format, getISOWeek, getISOWeekYear, getYear, startOfWeek } from 'date-fns';
import { vi } from 'date-fns/locale';
import { getRelevantUnderstaffedShifts } from '../../shift-scheduling/_components/understaffed-evidence-utils';

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

export default function WeekScheduleDialog({
  open,
  onOpenChange,
  schedule,
  allUsers,
  shiftTemplates,
  initialWeekInterval,
  onWeekChange,
  currentUser,
  evidences = [],
  onOpenBusyEvidence,
  parentDialogTag
}: WeekScheduleDialogProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekInterval, setWeekInterval] = useState(initialWeekInterval);

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

  const hasSchedule = !!schedule && schedule.shifts.length > 0;

  const relevantUnderstaffedShifts = useMemo<AssignedShift[]>(() => {
    // Still compute for highlighting cells if needed
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

  const renderUserBadge = (userId: string) => {
    const user = allUsers.find((u) => u.uid === userId);
    if (!user) return null;

    return (
      <Badge key={userId} className={cn('text-xs font-medium h-auto py-0.5 px-1.5 border', getRoleColor(user.role))}>
        {user.displayName}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} dialogTag="week-schedule-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-6xl p-0 overflow-hidden flex flex-col border-none sm:rounded-2xl">
        <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-3 pr-12 sm:pr-16 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-l sm:text-2xl font-bold font-headline tracking-tight">Lịch làm việc tuần</DialogTitle>
            {schedule && (
              <Badge variant={schedule.status === 'published' ? 'default' : 'secondary'} className="px-3 py-0.5 rounded-full text-[10px] sm:text-xs uppercase font-bold tracking-wider">
                {statusLabel[schedule.status]}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 bg-slate-50/30 dark:bg-transparent">
          {/* Action Header & Navigation */}
          <div className="px-4 sm:px-6 py-3 border-b bg-background sticky top-0 z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center justify-between sm:justify-start gap-4 order-2 sm:order-1">
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
                    "flex flex-1 items-center gap-3 px-3 py-2 rounded-xl border transition-all duration-300",
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

          <ScrollArea className="flex-1 min-h-0">
            {/* Desktop Table */}
            <div className="min-w-[1000px] max-h-[80vh] hidden md:block p-4 sm:p-6">
              {hasSchedule ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-card overflow-hidden shadow-sm">
                  <Table className="table-fixed w-full border-collapse">
                    <TableHeader>
                      <TableRow className="bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900/40 border-b border-slate-200 dark:border-slate-800">
                        <TableHead className="w-40 text-center font-bold text-slate-900 dark:text-slate-100 uppercase text-[11px] tracking-widest border-r border-slate-200 dark:border-slate-800">Ngày</TableHead>
                        {shiftTemplates.map((template) => (
                          <TableHead key={template.id} className="text-center font-bold p-3 border-r border-slate-200 dark:border-slate-800 last:border-r-0">
                            <div className="flex flex-col items-center">
                              <span className="text-slate-900 dark:text-slate-100 text-sm font-headline">{template.label}</span>
                              <Badge variant="outline" className="mt-1 font-mono text-[10px] py-0 px-1.5 h-4 border-slate-200 text-muted-foreground bg-white/50 dark:bg-slate-950/50">
                                {template.timeSlot.start} - {template.timeSlot.end}
                              </Badge>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {daysOfWeek.map((day) => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const isToday = dateKey === format(new Date(), 'yyyy-MM-dd');

                        return (
                          <TableRow key={dateKey} className={cn(
                            "group hover:bg-slate-50/50 dark:hover:bg-primary/5 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-b-0",
                            isToday ? "ring-1 ring-primary/20 bg-primary/5" : ""
                          )}>
                            <TableCell className="align-top p-4 bg-slate-50/30 dark:bg-slate-900/20 border-r border-slate-200 dark:border-slate-800 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="font-bold text-base text-slate-900 dark:text-slate-100">
                                  {format(day, 'eee', { locale: vi })}
                                </div>
                                {isToday && (
                                  <Badge variant="secondary" className="text-[10px] py-0 px-2 h-5">Hôm nay</Badge>
                                )}
                              </div>
                              <div className="text-xs font-semibold text-muted-foreground">
                                {format(day, 'dd/MM')}
                              </div>
                            </TableCell>
                            {shiftTemplates.map((template) => {
                              const dayOfWeek = day.getDay();
                              if (!(template.applicableDays || []).includes(dayOfWeek)) {
                                return <TableCell key={template.id} className="bg-slate-100/40 dark:bg-slate-900/40 border-r border-slate-200 dark:border-slate-800 last:border-r-0" />;
                              }

                              const shiftForCell = schedule?.shifts.find(
                                (s) => s.date === dateKey && s.templateId === template.id
                              );

                              if (!shiftForCell) {
                                return (
                                  <TableCell key={template.id} className="border-r border-slate-200 dark:border-slate-800 last:border-r-0 p-3 align-middle text-center text-[10px] text-muted-foreground/40 italic">
                                    Không có ca
                                  </TableCell>
                                );
                              }

                              const sortedUsers = [...shiftForCell.assignedUsers].sort((a, b) => {
                                const userA = allUsers.find((u) => u.uid === a.userId);
                                const userB = allUsers.find((u) => u.uid === b.userId);
                                if (!userA || !userB) return 0;
                                return (roleOrder[userA.role] || 99) - (roleOrder[userB.role] || 99);
                              });

                              const isUnderstaffed =
                                ((shiftForCell.minUsers || 0) > 0 && shiftForCell.assignedUsers.length < shiftForCell.minUsers) ||
                                ((shiftForCell.requiredRoles || []).some(req => {
                                  const assignedOfRole = shiftForCell.assignedUsers.filter(au => {
                                    const user = allUsers.find(u => u.uid === au.userId);
                                    const effRole = au.assignedRole ?? user?.role;
                                    return effRole === req.role;
                                  }).length;
                                  return assignedOfRole < req.count;
                                }));

                              const isRelevantToMe = relevantUnderstaffedShifts.some(s => s.id === shiftForCell.id);

                              return (
                                <TableCell
                                  key={template.id}
                                  className={cn(
                                    'border-r border-slate-200 dark:border-slate-800 last:border-r-0 align-top p-2.5 transition-colors',
                                    isRelevantToMe ? 'bg-amber-500/10 dark:bg-amber-500/5' : isUnderstaffed ? 'bg-destructive/5' : ''
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-1.5 mb-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="font-bold text-xs truncate leading-tight">{shiftForCell.label}</div>
                                      <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                                        {shiftForCell.timeSlot.start}-{shiftForCell.timeSlot.end}
                                      </div>
                                    </div>
                                    {isUnderstaffed && (
                                      <div className={cn(
                                        "p-1 rounded-md",
                                        isRelevantToMe ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40" : "bg-destructive/10 text-destructive"
                                      )}>
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {sortedUsers.length > 0 ? (
                                      sortedUsers.map((user) => renderUserBadge(user.userId))
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground/50 italic py-1 tracking-tight">Trống</span>
                                    )}
                                  </div>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-12 text-center bg-white/50 dark:bg-black/10">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center mb-4">
                    <ChevronRight className="h-8 w-8 text-muted-foreground/40 rotate-45" />
                  </div>
                  <h3 className="font-bold text-lg mb-1">Chưa có lịch làm việc</h3>
                  <p className="text-sm text-muted-foreground">Vui lòng chọn tuần khác hoặc chờ quản lý công bố lịch.</p>
                </div>
              )}
            </div>

            {/* Mobile layout */}
            <div className="md:hidden p-2 space-y-3 max-h-[80vh]">
              {hasSchedule ? (
                daysOfWeek.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const applicableTemplates = shiftTemplates.filter((t) => (t.applicableDays || []).includes(day.getDay()));

                  const isToday = dateKey === format(new Date(), 'yyyy-MM-dd');

                  return (
                    <div key={dateKey} className={cn("space-y-3", isToday ? "ring-1 ring-primary/20 bg-primary/5 rounded-md" : "")}>
                      <div className="flex items-center gap-3 sticky top-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm py-1 z-[5]">
                        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                        <div className="flex flex-col items-center">
                          <span className={cn("text-[11px] font-black uppercase text-primary tracking-widest leading-none mb-1", isToday ? "text-primary" : "")}>
                            {format(day, 'eeee', { locale: vi })}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-background rounded-full font-bold text-xs py-0 h-5 border-slate-300 dark:border-slate-700">
                              {format(day, 'dd/MM')}
                            </Badge>
                            {isToday && <Badge className="ml-1 bg-primary/10 text-primary text-[10px] px-2 py-0 h-5 font-bold">Hôm nay</Badge>}
                          </div>
                        </div>
                        <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                      </div>

                      <div className="grid gap-3">
                        {applicableTemplates.length > 0 ? (
                          applicableTemplates.map((template) => {
                            const shiftForCell = schedule?.shifts.find(
                              (s) => s.date === dateKey && s.templateId === template.id
                            );

                            if (!shiftForCell) return null;

                            const sortedUsers = [...shiftForCell.assignedUsers].sort((a, b) => {
                              const userA = allUsers.find((u) => u.uid === a.userId);
                              const userB = allUsers.find((u) => u.uid === b.userId);
                              if (!userA || !userB) return 0;
                              return (roleOrder[userA.role] || 99) - (roleOrder[userB.role] || 99);
                            });

                            const isUnderstaffed =
                              ((shiftForCell.minUsers || 0) > 0 && shiftForCell.assignedUsers.length < shiftForCell.minUsers) ||
                              ((shiftForCell.requiredRoles || []).some(req => {
                                const assignedOfRole = shiftForCell.assignedUsers.filter(au => {
                                  const user = allUsers.find(u => u.uid === au.userId);
                                  const effRole = au.assignedRole ?? user?.role;
                                  return effRole === req.role;
                                }).length;
                                return assignedOfRole < req.count;
                              }));

                            const isRelevantToMe = relevantUnderstaffedShifts.some(s => s.id === shiftForCell.id);

                            return (
                              <div
                                key={template.id}
                                className={cn(
                                  'group relative overflow-hidden rounded-2xl border transition-all duration-300',
                                  isRelevantToMe
                                    ? 'border-amber-200 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-900/10'
                                    : 'border-slate-100 bg-card dark:border-slate-800 dark:bg-slate-900/10'
                                )}
                              >
                                {/* Side Indicator */}
                                {isUnderstaffed && (
                                  <div className={cn(
                                    "absolute left-0 top-0 w-1 h-full",
                                    isRelevantToMe ? "bg-amber-500" : "bg-destructive/40"
                                  )} />
                                )}

                                <div className="p-3.5 pl-4 flex flex-col gap-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 mb-0.5">
                                        <h4 className="font-bold text-sm tracking-tight">{shiftForCell.label}</h4>
                                        <Badge variant="outline" className="text-[9px] h-3.5 px-1 py-0 border-slate-200 uppercase font-bold text-muted-foreground font-mono">
                                          {shiftForCell.role}
                                        </Badge>
                                      </div>
                                      <div className="text-[11px] font-bold text-primary flex items-center gap-1.5">
                                        <span>{shiftForCell.timeSlot.start}</span>
                                        <span className="text-muted-foreground/50">—</span>
                                        <span>{shiftForCell.timeSlot.end}</span>
                                      </div>
                                    </div>
                                    {isUnderstaffed && (
                                      <div className={cn(
                                        "p-1.5 rounded-lg border flex items-center gap-1",
                                        isRelevantToMe ? "bg-amber-100 border-amber-200 text-amber-600" : "bg-destructive/5 border-destructive/10 text-destructive"
                                      )}>
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-bold">Lacking</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap gap-1.5">
                                    {sortedUsers.length > 0 ? (
                                      sortedUsers.map((user) => renderUserBadge(user.userId))
                                    ) : (
                                      <span className="text-[11px] text-muted-foreground/60 italic px-1">Chưa có nhân viên trực ca này</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-[11px] py-4 text-center text-muted-foreground/40 italic bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border border-dashed">
                            Không có ca làm việc
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-8 text-center bg-white/50 dark:bg-black/10">
                  <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-900 flex items-center justify-center mb-3">
                    <ChevronRight className="h-6 w-6 text-muted-foreground/40 rotate-45" />
                  </div>
                  <h3 className="font-bold text-base mb-1">Chưa có lịch</h3>
                  <p className="text-xs text-muted-foreground">Công việc cho tuần này chưa được lập.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

