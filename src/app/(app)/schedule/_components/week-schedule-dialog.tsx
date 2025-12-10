'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ManagedUser, Schedule, ShiftTemplate, UserRole } from '@/lib/types';
import { cn } from '@/lib/utils';
import { addWeeks, eachDayOfInterval, endOfWeek, format, getISOWeek, getYear, startOfWeek } from 'date-fns';
import { vi } from 'date-fns/locale';

interface WeekScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: Schedule | null;
  allUsers: ManagedUser[];
  shiftTemplates: ShiftTemplate[];
  initialWeekInterval: { start: Date; end: Date };
  onWeekChange: (weekId: string) => void;
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
    const id = `${getYear(newStart)}-W${getISOWeek(newStart)}`;
    setWeekInterval({ start, end });
    onWeekChange(id);
  }, [initialWeekInterval.start, weekOffset, onWeekChange]);

  const daysOfWeek = useMemo(
    () => eachDayOfInterval({ start: weekInterval.start, end: weekInterval.end }),
    [weekInterval]
  );

  const hasSchedule = !!schedule && schedule.shifts.length > 0;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Lịch làm việc tuần</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={() => setWeekOffset((prev) => prev - 1)}>
              <ChevronLeft className="h-4 w-4 md:mr-2" />
              <span className="hidden md:inline">Tuần trước</span>
            </Button>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="text-lg font-semibold">
                {format(weekInterval.start, 'dd/MM')} - {format(weekInterval.end, 'dd/MM/yyyy')}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {weekOffset !== 0 && (
                  <Button variant="secondary" size="sm" onClick={() => setWeekOffset(0)}>
                    Về tuần hiện tại
                  </Button>
                )}
                {schedule && <Badge variant={schedule.status === 'published' ? 'default' : 'secondary'}>{statusLabel[schedule.status]}</Badge>}
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={() => setWeekOffset((prev) => prev + 1)}>
              <span className="hidden md:inline">Tuần sau</span>
              <ChevronRight className="h-4 w-4 md:ml-2" />
            </Button>
          </div>

          <ScrollArea className="max-h-[70vh]">
            <div className="min-w-[960px] hidden md:block">
              {hasSchedule ? (
                <Table className="table-fixed w-full border">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40 text-center font-bold">Ngày</TableHead>
                      {shiftTemplates.map((template) => (
                        <TableHead key={template.id} className="text-center font-bold border-l">
                          <p>{template.label}</p>
                          <p className="text-xs text-muted-foreground font-normal">
                            {template.timeSlot.start} - {template.timeSlot.end}
                          </p>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {daysOfWeek.map((day) => {
                      const dateKey = format(day, 'yyyy-MM-dd');

                      return (
                        <TableRow key={dateKey} className="border-t align-top">
                          <TableCell className="font-semibold text-center align-top">
                            <div>{format(day, 'eee, dd/MM', { locale: vi })}</div>
                          </TableCell>
                          {shiftTemplates.map((template) => {
                            const dayOfWeek = day.getDay();
                            if (!(template.applicableDays || []).includes(dayOfWeek)) {
                              return <TableCell key={template.id} className="bg-muted/40 border-l" />;
                            }

                            const shiftForCell = schedule?.shifts.find(
                              (s) => s.date === dateKey && s.templateId === template.id
                            );

                            if (!shiftForCell) {
                              return (
                                <TableCell key={template.id} className="border-l text-center text-xs text-muted-foreground">
                                  <span className="italic">Không có ca</span>
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
                              (shiftForCell.minUsers || 0) > 0 &&
                              shiftForCell.assignedUsers.length < shiftForCell.minUsers;

                            return (
                              <TableCell
                                key={template.id}
                                className={cn(
                                  'border-l align-top p-2',
                                  isUnderstaffed && 'bg-destructive/10'
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-left">
                                    <div className="font-semibold text-sm leading-tight">{shiftForCell.label}</div>
                                    <div className="text-xs text-muted-foreground leading-tight">
                                      {shiftForCell.timeSlot.start} - {shiftForCell.timeSlot.end}
                                    </div>
                                  </div>
                                  {isUnderstaffed && <AlertTriangle className="h-4 w-4 text-destructive" />}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {sortedUsers.length > 0 ? (
                                    sortedUsers.map((user) => renderUserBadge(user.userId))
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">Chưa có nhân viên</span>
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
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                  Không có lịch cho tuần này.
                </div>
              )}
            </div>

            {/* Mobile layout */}
            <div className="space-y-3 md:hidden">
              {hasSchedule ? (
                daysOfWeek.map((day) => {
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const applicableTemplates = shiftTemplates.filter((t) => (t.applicableDays || []).includes(day.getDay()));
                  return (
                    <div key={dateKey} className="rounded-lg border p-3 bg-card shadow-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">{format(day, 'eeee, dd/MM', { locale: vi })}</div>
                        <Badge variant="outline">{format(day, 'dd/MM')}</Badge>
                      </div>
                      <div className="mt-3 space-y-2">
                        {applicableTemplates.length > 0 ? (
                          applicableTemplates.map((template) => {
                            const shiftForCell = schedule?.shifts.find(
                              (s) => s.date === dateKey && s.templateId === template.id
                            );

                            if (!shiftForCell) {
                              return (
                                <div key={template.id} className="border rounded-md p-3 bg-muted/20 text-sm text-muted-foreground">
                                  <div className="font-semibold">{template.label}</div>
                                  <div className="text-xs">{template.timeSlot.start} - {template.timeSlot.end}</div>
                                  <div className="italic text-xs mt-1">Không có ca</div>
                                </div>
                              );
                            }

                            const sortedUsers = [...shiftForCell.assignedUsers].sort((a, b) => {
                              const userA = allUsers.find((u) => u.uid === a.userId);
                              const userB = allUsers.find((u) => u.uid === b.userId);
                              if (!userA || !userB) return 0;
                              return (roleOrder[userA.role] || 99) - (roleOrder[userB.role] || 99);
                            });

                            const isUnderstaffed =
                              (shiftForCell.minUsers || 0) > 0 &&
                              shiftForCell.assignedUsers.length < shiftForCell.minUsers;

                            return (
                              <div
                                key={template.id}
                                className={cn(
                                  'border rounded-md p-3 bg-card',
                                  isUnderstaffed && 'border-destructive bg-destructive/10'
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-semibold text-sm leading-tight">{shiftForCell.label}</div>
                                    <div className="text-xs text-muted-foreground leading-tight">
                                      {shiftForCell.timeSlot.start} - {shiftForCell.timeSlot.end}
                                    </div>
                                  </div>
                                  {isUnderstaffed && <AlertTriangle className="h-4 w-4 text-destructive" />}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {sortedUsers.length > 0 ? (
                                    sortedUsers.map((user) => renderUserBadge(user.userId))
                                  ) : (
                                    <span className="text-xs text-muted-foreground italic">Chưa có nhân viên</span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-sm text-muted-foreground italic">Không có ca trong ngày.</div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                  Không có lịch cho tuần này.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
