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
};

export default function WorkHistoryDialog({ isOpen, onClose, user }: WorkHistoryDialogProps) {
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
    <Dialog open={isOpen} onOpenChange={onClose} dialogTag="work-history-dialog" parentDialogTag="root">
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Lịch sử làm việc của bạn</DialogTitle>
          <DialogDescription>
            Xem lại giờ làm và lương dự tính của bạn.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 py-4 border-y px-6 -mx-6">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className={cn('w-full sm:w-[200px] justify-center font-medium')}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(currentMonth, 'MM/yyyy')}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setCurrentMonth(startOfMonth(new Date()))}
            >
              Tháng hiện tại
            </Button>
          </div>
          <div className="w-full sm:w-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
              {/* Total Estimated Salary */}
              <div className="rounded-xl border bg-white shadow-sm p-2 flex flex-col">
                <p className="text-xs font-medium text-muted-foreground">Tổng lương dự tính</p>
                <p className="text-sm font-bold mt-1 text-primary">
                  {summary.totalSalary.toLocaleString('vi-VN')}đ
                </p>
              </div>

              {/* Total Hours */}
              <div className="rounded-xl border bg-white shadow-sm p-2 flex flex-col">
                <p className="text-xs font-medium text-muted-foreground">Tổng giờ làm</p>
                <p className="text-sm font-semibold mt-1">
                  {summary.totalHours.toFixed(2)}
                  <span className="text-sm text-muted-foreground ml-1">giờ</span>
                </p>
              </div>

              {/* Hourly Rate */}
              <div className="rounded-xl border bg-white shadow-sm p-2 flex flex-col">
                <p className="text-xs font-medium text-muted-foreground">Mức lương hiện tại</p>
                <p className="text-sm font-semibold mt-1">
                  {hourlyRate !== null ? `${hourlyRate.toLocaleString('vi-VN')}đ/giờ` : 'N/A'}
                </p>
              </div>

              {/* This Month Payout */}
              <div className="rounded-xl border bg-white shadow-sm p-2 flex flex-col">
                <p className="text-xs font-medium text-muted-foreground">Thanh toán tháng này</p>

                {monthlyPayInfo?.status === 'paid' ? (
                  <p className="text-sm font-semibold text-green-600 mt-1">
                    {(monthlyPayInfo.actualPaidAmount || 0).toLocaleString('vi-VN')}đ
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-muted-foreground mt-1">Chưa trả</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-grow pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
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
                      "transition-colors",
                      isWithinSpecialPeriod && "border-amber-400 bg-amber-50/40 dark:border-amber-500/50 dark:bg-amber-950/20"
                    )}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className={cn("text-base", isWithinSpecialPeriod && "text-amber-700 dark:text-amber-400")}>
                            {format(recordDate, 'eeee, dd/MM/yyyy', { locale: vi })}
                          </CardTitle>
                          <div className="text-xs text-muted-foreground">
                            {shifts.length > 0 ? shifts.map(s => s.label).join(', ') : (record.isOffShift ? 'Ngoài giờ' : 'N/A')}
                          </div>
                          {isWithinSpecialPeriod && typeof record.hourlyRate === 'number' && (
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "text-xs",
                                  isWithinSpecialPeriod && "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-200"
                                )}
                              >
                                {typeof record.salaryMultiplierApplied === 'number' && record.salaryMultiplierApplied !== 1
                                  ? `x${record.salaryMultiplierApplied}`
                                  : 'Đặc biệt'}
                              </Badge>
                              <span>Lương giờ: {record.hourlyRate.toLocaleString('vi-VN')}đ/giờ</span>
                              {record.specialPeriodAppliedName ? (
                                <span className="truncate">({record.specialPeriodAppliedName})</span>
                              ) : null}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className={cn("border-none text-xs", statusInfo.color)}>{statusInfo.text}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Giờ vào/ra</span>
                        <span>
                          {format(recordDate, 'HH:mm')} - {record.checkOutTime ? format((record.checkOutTime as Timestamp).toDate(), 'HH:mm') : 'N/A'} ({record.totalHours != null ? `${record.totalHours.toFixed(2)} giờ` : 'N/A'})
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2 mt-2">
                        <span className="text-muted-foreground font-semibold">Lương</span>
                        <span className="font-bold text-base text-primary">{record.salary?.toLocaleString('vi-VN')}đ</span>
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
                  <TableRow>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Ca làm việc</TableHead>
                    <TableHead>Giờ vào</TableHead>
                    <TableHead>Giờ ra</TableHead>
                    <TableHead className="text-center">Trạng thái</TableHead>
                    <TableHead className="text-center">Tổng giờ</TableHead>
                    <TableHead className="text-right">Lương</TableHead>
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
                          isWithinSpecialPeriod && "bg-amber-50/50 hover:bg-amber-100/50 dark:bg-amber-950/20 dark:hover:bg-amber-900/30"
                        )}
                      >
                        <TableCell>{format(recordDate, 'dd/MM/yyyy')}</TableCell>
                        <TableCell>{shifts.length > 0 ? shifts.map(s => s.label).join(', ') : (record.isOffShift ? 'Ngoài giờ' : 'N/A')}</TableCell>
                        <TableCell>{format(recordDate, 'HH:mm')}</TableCell>
                        <TableCell>{record.checkOutTime ? format((record.checkOutTime as Timestamp).toDate(), 'HH:mm') : 'N/A'}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline" className={cn("border-none", statusInfo.color)}>{statusInfo.text}</Badge></TableCell>
                        <TableCell className="text-center">{record.totalHours?.toFixed(2) ?? 'N/A'}</TableCell>
                        <TableCell className="text-right font-medium">
                          <div>{record.salary?.toLocaleString('vi-VN')}đ</div>
                          {isWithinSpecialPeriod && typeof record.hourlyRate === 'number' && (
                            <div className="text-xs text-muted-foreground">
                              {typeof record.salaryMultiplierApplied === 'number' && record.salaryMultiplierApplied !== 1
                                ? `x${record.salaryMultiplierApplied} · `
                                : ''}
                              {record.hourlyRate.toLocaleString('vi-VN')}đ/giờ
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
