
'use client';
import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ManagedUser, Schedule, Availability } from '@/lib/types';
import { format, startOfMonth, endOfMonth, isSameDay, eachDayOfInterval } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { calculateTotalHours } from '@/lib/schedule-utils';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function AvailabilityTab({ weekAvailability }: { weekAvailability: Availability[] }) {
    if (weekAvailability.length === 0) {
        return <p className="text-sm text-muted-foreground text-center py-8">Nhân viên này chưa đăng ký thời gian rảnh cho tuần này.</p>;
    }
    
    // Sort by date
    const sortedAvailability = weekAvailability.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return (
        <div className="space-y-4">
            {sortedAvailability.map(avail => (
                <div key={avail.date}>
                    <h4 className="font-semibold">{format(new Date(avail.date), 'eeee, dd/MM', { locale: vi })}</h4>
                    {avail.availableSlots.length > 0 ? (
                        <div className="mt-1 space-y-1">
                            {avail.availableSlots.map((slot, index) => (
                                <div key={index} className="text-sm bg-muted p-2 rounded-md">
                                    {slot.start} - {slot.end}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground italic mt-1">Không có khung giờ rảnh.</p>
                    )}
                </div>
            ))}
        </div>
    );
}

function HistoryTab({ user, allSchedules }: { user: ManagedUser, allSchedules: Schedule[] }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    
    const userShiftsByDate = useMemo(() => {
        const shiftsMap = new Map<string, { label: string; timeSlot: string }[]>();
        allSchedules.forEach(schedule => {
            if (schedule.status !== 'published') return;
            schedule.shifts.forEach(shift => {
                if (shift.assignedUsers.some(u => u.userId === user.uid)) {
                    const dateKey = shift.date;
                    if (!shiftsMap.has(dateKey)) {
                        shiftsMap.set(dateKey, []);
                    }
                    shiftsMap.get(dateKey)!.push({
                        label: shift.label,
                        timeSlot: `${shift.timeSlot.start}-${shift.timeSlot.end}`
                    });
                }
            });
        });
        return shiftsMap;
    }, [allSchedules, user.uid]);
    
    const daysInMonth = useMemo(() => {
        const start = startOfMonth(currentMonth);
        const end = endOfMonth(currentMonth);
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    const totalHoursThisMonth = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const shiftsThisMonth = allSchedules.flatMap(s => s.shifts)
            .filter(shift => {
                if(s.status !== 'published') return false;
                const shiftDate = new Date(shift.date);
                return shift.assignedUsers.some(u => u.userId === user.uid) &&
                       shiftDate >= monthStart && shiftDate <= monthEnd;
            });
        return calculateTotalHours(shiftsThisMonth.map(s => s.timeSlot));
    }, [allSchedules, user.uid, currentMonth]);
    
    const handleMonthChange = (direction: 'prev' | 'next') => {
        setCurrentMonth(prev => {
            const newMonth = new Date(prev);
            newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
            return newMonth;
        });
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="p-4 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-base">Thống kê tháng {format(currentMonth, 'MM/yyyy')}</CardTitle>
                        <CardDescription>
                            Tổng giờ làm: <span className="font-bold text-primary">{totalHoursThisMonth.toFixed(1)} giờ</span>
                        </CardDescription>
                    </div>
                     <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => handleMonthChange('prev')}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => handleMonthChange('next')}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
            </Card>
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[150px]">Ngày</TableHead>
                            <TableHead>Ca làm việc</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                       {daysInMonth.map(day => {
                           const dateKey = format(day, 'yyyy-MM-dd');
                           const shiftsForDay = userShiftsByDate.get(dateKey);

                           if (!shiftsForDay || shiftsForDay.length === 0) {
                               return null; // Skip days with no shifts
                           }

                           return (
                               <TableRow key={dateKey}>
                                   <TableCell className="font-medium align-top">
                                        {format(day, 'eeee, dd/MM', { locale: vi })}
                                   </TableCell>
                                   <TableCell>
                                        <div className="flex flex-col gap-1">
                                            {shiftsForDay.map((shift, index) => (
                                                <div key={index} className="text-sm">
                                                    <span className="font-semibold">{shift.label}:</span>
                                                    <span className="text-muted-foreground ml-2">{shift.timeSlot}</span>
                                                </div>
                                            ))}
                                        </div>
                                   </TableCell>
                               </TableRow>
                           )
                       })}
                        {totalHoursThisMonth === 0 && (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center text-muted-foreground h-24">
                                    Không có ca làm việc nào trong tháng này.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

export default function UserDetailsDialog({
    isOpen,
    onClose,
    user,
    allSchedules,
    weekAvailability,
}: {
    isOpen: boolean;
    onClose: () => void;
    user: ManagedUser;
    allSchedules: Schedule[];
    weekAvailability: Availability[];
}) {
    if (!user) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Chi tiết: {user.displayName}</DialogTitle>
                    <DialogDescription>
                        Xem thông tin về thời gian rảnh và lịch sử làm việc của nhân viên.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Tabs defaultValue="availability">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="availability"><Clock className="mr-2 h-4 w-4" /> Thời gian rảnh (Tuần này)</TabsTrigger>
                            <TabsTrigger value="history">Lịch sử làm việc</TabsTrigger>
                        </TabsList>
                        <TabsContent value="availability" className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
                            <AvailabilityTab weekAvailability={weekAvailability} />
                        </TabsContent>
                        <TabsContent value="history" className="mt-4 max-h-[70vh] overflow-y-auto pr-2">
                            <HistoryTab user={user} allSchedules={allSchedules} />
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
