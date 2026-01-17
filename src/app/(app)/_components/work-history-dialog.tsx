'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { dataStore } from '@/lib/data-store';
import type { AuthUser, AttendanceRecord, Schedule } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import { findShiftForRecord, getStatusInfo } from '@/lib/attendance-utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type WorkHistoryDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser;
  parentDialogTag: string;
};

export default function WorkHistoryDialog({ isOpen, onClose, user, parentDialogTag }: WorkHistoryDialogProps) {
  const isMobile = useIsMobile();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [schedules, setSchedules] = useState<Record<string, Schedule>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [hourlyRate, setHourlyRate] = useState<number | null>(null);
  const [monthlyPayInfo, setMonthlyPayInfo] = useState<{ status?: 'paid' | 'unpaid'; actualPaidAmount?: number; paidAt?: Timestamp } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDateRange({ from: startOfMonth(currentMonth), to: endOfMonth(currentMonth) });
    }
  }, [isOpen, currentMonth]);

  useEffect(() => {
    if (isOpen && user && dateRange?.from && dateRange?.to) {
      setIsLoading(true);
      const unsub = dataStore.subscribeToUserAttendanceForDateRange(
        user.uid,
        dateRange,
        (newRecords) => {
          setRecords(newRecords);
          setIsLoading(false);
        }
      );

      const unsubSchedules = dataStore.subscribeToSchedulesForDateRange(dateRange, (newSchedules) => {
        const scheduleMap = newSchedules.reduce((acc, s) => {
          acc[s.weekId] = s;
          return acc;
        }, {} as Record<string, Schedule>);
        setSchedules(scheduleMap);
      });

      return () => { unsub(); unsubSchedules(); };
    }
  }, [isOpen, user, dateRange]);

  useEffect(() => {
    if (!isOpen || !user) return;
    const unsubUsers = dataStore.subscribeToUsers((users) => {
      const me = users.find(u => u.uid === user.uid);
      setHourlyRate(me?.hourlyRate ?? null);
    });
    return () => { unsubUsers(); };
  }, [isOpen, user]);

  useEffect(() => {
    if (!isOpen || !user) return;
    const monthId = format(currentMonth, 'yyyy-MM');
    dataStore.getMonthlySalarySheet(monthId).then(sheet => {
      if (sheet && sheet.salaryRecords[user.uid]) {
        const r = sheet.salaryRecords[user.uid];
        setMonthlyPayInfo({ status: r.paymentStatus, actualPaidAmount: r.actualPaidAmount, paidAt: r.paidAt });
      } else {
        setMonthlyPayInfo(null);
      }
    }).catch(() => setMonthlyPayInfo(null));
  }, [isOpen, user, currentMonth]);

  const summary = useMemo(() => {
    return records.reduce(
      (acc, record) => {
        acc.totalHours += record.totalHours || 0;
        acc.totalSalary += record.salary || 0;
        return acc;
      },
      { totalHours: 0, totalSalary: 0 }
    );
  }, [records]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="work-history-dialog" parentDialogTag={parentDialogTag}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-2 space-y-0.5">
          <DialogTitle className="text-lg">Lịch sử làm việc của bạn</DialogTitle>
          <DialogDescription className="text-xs">
            Xem lại giờ làm và lương dự tính của bạn.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 py-2 border-y px-4 bg-muted/20">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={cn('w-full sm:w-[140px] justify-center font-medium h-8')}
            >
              <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
              {format(currentMonth, 'MM/yyyy')}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs px-2"
              onClick={() => setCurrentMonth(startOfMonth(new Date()))}
            >
              Hiện tại
            </Button>
          </div>
          <div className="w-full sm:w-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
              {/* Total Estimated Salary */}
              <div className="rounded-lg border bg-white shadow-sm p-1.5 flex flex-col min-w-[80px]">
                <p className="text-[10px] font-medium text-muted-foreground leading-tight truncate">Lương dự tính</p>
                <p className="text-xs font-bold text-primary truncate">
                  {summary.totalSalary.toLocaleString('vi-VN')}đ
                </p>
              </div>

              {/* Total Hours */}
              <div className="rounded-lg border bg-white shadow-sm p-1.5 flex flex-col min-w-[80px]">
                <p className="text-[10px] font-medium text-muted-foreground leading-tight truncate">Giờ làm</p>
                <p className="text-xs font-semibold truncate">
                  {summary.totalHours.toFixed(2)}
                  <span className="text-[10px] text-muted-foreground ml-0.5">h</span>
                </p>
              </div>

              {/* Hourly Rate */}
              <div className="rounded-lg border bg-white shadow-sm p-1.5 flex flex-col min-w-[80px]">
                <p className="text-[10px] font-medium text-muted-foreground leading-tight truncate">Mức lương</p>
                <p className="text-xs font-semibold truncate">
                  {hourlyRate !== null ? `${hourlyRate.toLocaleString('vi-VN')}đ` : 'N/A'}
                </p>
              </div>

              {/* This Month Payout */}
              <div className="rounded-lg border bg-white shadow-sm p-1.5 flex flex-col min-w-[80px]">
                <p className="text-[10px] font-medium text-muted-foreground leading-tight truncate">Đã trả</p>

                {monthlyPayInfo?.status === 'paid' ? (
                  <p className="text-xs font-semibold text-green-600 truncate">
                    {(monthlyPayInfo.actualPaidAmount || 0).toLocaleString('vi-VN')}đ
                  </p>
                ) : (
                  <p className="text-xs font-semibold text-muted-foreground truncate">Chưa</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-grow px-4 py-2 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isMobile ? (
            <div className="space-y-2">
              {records.length > 0 ? records.map((record) => {
                const recordDate = (record.checkInTime as Timestamp).toDate();
                const shifts = findShiftForRecord(record, schedules);
                const statusInfo = getStatusInfo(record, shifts);
                const isWithinSpecialPeriod =
                  (record.specialPeriodAppliedId ?? null) !== null ||
                  (typeof record.salaryMultiplierApplied === 'number' && record.salaryMultiplierApplied !== 1);
                return (
                  <Card
                    key={record.id}
                    className={cn(
                      "transition-colors shadow-none",
                      isWithinSpecialPeriod && "border-amber-400 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-950/20"
                    )}
                  >
                    <CardHeader className="p-3 pb-1.5 space-y-0.5">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className={cn("text-sm font-semibold", isWithinSpecialPeriod && "text-amber-700 dark:text-amber-400")}>
                            {format(recordDate, 'eeee, dd/MM/yyyy', { locale: vi })}
                          </CardTitle>
                          <div className="text-[11px] text-muted-foreground">
                            {shifts.length > 0 ? shifts.map(s => s.label).join(', ') : (record.isOffShift ? 'Ngoài giờ' : 'N/A')}
                          </div>
                          {isWithinSpecialPeriod && typeof record.hourlyRate === 'number' && (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-[10px] h-4 px-1.5",
                                  isWithinSpecialPeriod && "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-200"
                                )}
                              >
                                {typeof record.salaryMultiplierApplied === 'number' && record.salaryMultiplierApplied !== 1
                                  ? `x${record.salaryMultiplierApplied}`
                                  : 'Đặc biệt'}
                              </Badge>
                              <span>{record.hourlyRate.toLocaleString('vi-VN')}đ/h</span>
                              {record.specialPeriodAppliedName ? (
                                <span className="truncate opacity-70">({record.specialPeriodAppliedName})</span>
                              ) : null}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className={cn("border-none text-[10px] h-5 px-1.5", statusInfo.color)}>{statusInfo.text}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 text-xs space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Giờ vào/ra</span>
                        <span className="font-medium">
                          {format(recordDate, 'HH:mm')} - {record.checkOutTime ? format((record.checkOutTime as Timestamp).toDate(), 'HH:mm') : 'N/A'} ({record.totalHours?.toFixed(1)}h)
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t border-dashed pt-1.5 mt-1.5">
                        <span className="text-muted-foreground font-medium">Lương dự tính</span>
                        <span className="font-bold text-sm text-primary">{record.salary?.toLocaleString('vi-VN')}đ</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              }) : (
                <div className="h-24 flex items-center justify-center text-center text-muted-foreground">
                  Không có dữ liệu trong khoảng thời gian này.
                </div>
              )}
            </div>
          ) : (
            <div className="relative w-full overflow-auto rounded border shadow-sm bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="h-10 hover:bg-transparent">
                    <TableHead className="h-10 py-0">Ngày</TableHead>
                    <TableHead className="h-10 py-0">Ca làm việc</TableHead>
                    <TableHead className="h-10 py-0">Giờ vào</TableHead>
                    <TableHead className="h-10 py-0">Giờ ra</TableHead>
                    <TableHead className="h-10 py-0 text-center">Trạng thái</TableHead>
                    <TableHead className="h-10 py-0 text-center">Tổng giờ</TableHead>
                    <TableHead className="h-10 py-0 text-right">Lương</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length > 0 ? records.map((record) => {
                    const recordDate = (record.checkInTime as Timestamp).toDate();
                    const shifts = findShiftForRecord(record, schedules);
                    const statusInfo = getStatusInfo(record, shifts);
                    const isWithinSpecialPeriod =
                      (record.specialPeriodAppliedId ?? null) !== null ||
                      (typeof record.salaryMultiplierApplied === 'number' && record.salaryMultiplierApplied !== 1);
                    return (
                      <TableRow
                        key={record.id}
                        className={cn(
                          "h-12",
                          isWithinSpecialPeriod && "bg-amber-50/50 hover:bg-amber-100/50 dark:bg-amber-950/20 dark:hover:bg-amber-900/30"
                        )}
                      >
                        <TableCell className="py-2">{format(recordDate, 'dd/MM/yyyy')}</TableCell>
                        <TableCell className="py-2">{shifts.length > 0 ? shifts.map(s => s.label).join(', ') : (record.isOffShift ? 'Ngoài giờ' : 'N/A')}</TableCell>
                        <TableCell className="py-2">{format(recordDate, 'HH:mm')}</TableCell>
                        <TableCell className="py-2">{record.checkOutTime ? format((record.checkOutTime as Timestamp).toDate(), 'HH:mm') : 'N/A'}</TableCell>
                        <TableCell className="py-2 text-center"><Badge variant="outline" className={cn("border-none text-[10px] h-5", statusInfo.color)}>{statusInfo.text}</Badge></TableCell>
                        <TableCell className="py-2 text-center">{record.totalHours?.toFixed(1) ?? 'N/A'}</TableCell>
                        <TableCell className="py-2 text-right font-medium">
                          <div className="text-sm">{record.salary?.toLocaleString('vi-VN')}đ</div>
                          {isWithinSpecialPeriod && typeof record.hourlyRate === 'number' && (
                            <div className="text-[10px] text-muted-foreground leading-tight">
                              {typeof record.salaryMultiplierApplied === 'number' && record.salaryMultiplierApplied !== 1
                                ? `x${record.salaryMultiplierApplied} · `
                                : ''}
                              {record.hourlyRate.toLocaleString('vi-VN')}đ/h
                              {record.specialPeriodAppliedName ? ` · ${record.specialPeriodAppliedName}` : ''}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        Không có dữ liệu trong khoảng thời gian này.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="p-2 sm:p-3 border-t">
          <Button variant="outline" size="sm" className="h-8" onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
