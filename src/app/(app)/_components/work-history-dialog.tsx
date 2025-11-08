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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { format, startOfMonth, endOfMonth } from 'date-fns';
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Lịch sử làm việc của bạn</DialogTitle>
          <DialogDescription>
            Xem lại giờ làm và lương dự tính của bạn.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 py-4 border-y px-6 -mx-6">
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                    'w-full sm:w-[280px] justify-start text-left font-normal',
                    !dateRange && 'text-muted-foreground'
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                    dateRange.to ? (
                        <>
                        {format(dateRange.from, 'dd/MM/yy')} - {format(dateRange.to, 'dd/MM/yy')}
                        </>
                    ) : (
                        format(dateRange.from, 'dd/MM/yy')
                    )
                    ) : (
                    <span>Chọn khoảng thời gian</span>
                    )}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={isMobile ? 1 : 2}
                />
                </PopoverContent>
            </Popover>
            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 p-3 rounded-lg bg-card border mr-2">
                <div className="text-left sm:text-right">
                    <p className="text-sm font-medium text-muted-foreground">Tổng lương dự tính</p>
                    <p className="text-2xl font-bold text-primary">{summary.totalSalary.toLocaleString('vi-VN')}đ</p>
                </div>
                <div className="text-left sm:text-right pl-4 border-l">
                    <p className="text-sm font-medium text-muted-foreground">Tổng giờ làm</p>
                    <p className="text-xl font-semibold">{summary.totalHours.toFixed(2)} <span className="text-sm text-muted-foreground">giờ</span></p>
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
                    return (
                        <Card key={record.id}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-base">{format(recordDate, 'eeee, dd/MM/yyyy', { locale: vi })}</CardTitle>
                                        <div className="text-xs text-muted-foreground">
                                            {shifts.length > 0 ? shifts.map(s => s.label).join(', ') : (record.isOffShift ? 'Ngoài giờ' : 'N/A')}
                                        </div>
                                    </div>
                                    <Badge variant="outline" className={cn("border-none text-xs", statusInfo.color)}>{statusInfo.text}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2">
                                <div className="flex justify-between"><span className="text-muted-foreground">Giờ vào/ra:</span> <span>{format(recordDate, 'HH:mm')} - {record.checkOutTime ? format((record.checkOutTime as Timestamp).toDate(), 'HH:mm') : 'N/A'}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Tổng giờ:</span> <span>{record.totalHours?.toFixed(2) ?? 'N/A'} giờ</span></div>
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
                            return (
                                <TableRow key={record.id}>
                                <TableCell>{format(recordDate, 'dd/MM/yyyy')}</TableCell>
                                <TableCell>{shifts.length > 0 ? shifts.map(s => s.label).join(', ') : (record.isOffShift ? 'Ngoài giờ' : 'N/A')}</TableCell>
                                <TableCell>{format(recordDate, 'HH:mm')}</TableCell>
                                <TableCell>{record.checkOutTime ? format((record.checkOutTime as Timestamp).toDate(), 'HH:mm') : 'N/A'}</TableCell>
                                <TableCell className="text-center"><Badge variant="outline" className={cn("border-none", statusInfo.color)}>{statusInfo.text}</Badge></TableCell>
                                <TableCell className="text-center">{record.totalHours?.toFixed(2) ?? 'N/A'}</TableCell>
                                <TableCell className="text-right font-medium">{record.salary?.toLocaleString('vi-VN')}đ</TableCell>
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