
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ManagedUser, Schedule, Availability } from '@/lib/types';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import { calculateTotalHours } from '@/lib/schedule-utils';
import { Clock, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { dataStore } from '@/lib/data-store';

function AvailabilityTab({ weekAvailability }: { weekAvailability: Availability[] }) {
    if (weekAvailability.length === 0) {
        return <p className="text-sm text-muted-foreground text-center py-8">Nhân viên này chưa đăng ký thời gian rảnh cho tuần này.</p>;
    }
    
    // Sort by date
    const sortedAvailability = weekAvailability.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return (
        <div className="border rounded-md bg-card">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[35%] text-center">Ngày</TableHead>
                        <TableHead className="text-center">Thời gian rảnh đã đăng ký</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedAvailability.map(avail => {
                        if (avail.availableSlots.length === 0) return null;
                        return (
                            <TableRow key={avail.date}>
                                <TableCell className="font-semibold text-base align-middle text-center">
                                    {format(new Date(avail.date), 'eeee, dd/MM', { locale: vi })}
                                </TableCell>
                                <TableCell className="align-middle text-center p-2">
                                     <div className="space-y-2 max-w-sm mx-auto">
                                        {avail.availableSlots.map((slot, index) => (
                                            <Card key={index} className="text-left bg-blue-100/60 dark:bg-blue-900/40">
                                                <CardContent className="p-3">
                                                    <p className="font-semibold text-sm text-center">{slot.start} - {slot.end}</p>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    );
}

function HistoryTab({ user }: { user: ManagedUser }) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
    const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);
    
    useEffect(() => {
        setIsLoading(true);
        dataStore.getSchedulesForMonth(currentMonth).then(monthlySchedules => {
            setSchedules(monthlySchedules);
            setIsLoading(false);
        });
    }, [currentMonth]);

    const userShiftsByDate = useMemo(() => {
        const shiftsMap = new Map<string, { label: string; timeSlot: string }[]>();
        const publishedSchedules = schedules.filter(s => s.status === 'published');

        publishedSchedules.forEach(schedule => {
            schedule.shifts.forEach(shift => {
                 const shiftDate = new Date(shift.date);
                if (shift.assignedUsers.some(u => u.userId === user.uid) && shiftDate >= monthStart && shiftDate <= monthEnd) {
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
    }, [schedules, user.uid, monthStart, monthEnd]);
    
    const daysWithShifts = useMemo(() => {
        return Array.from(userShiftsByDate.keys()).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());
    }, [userShiftsByDate]);

    const totalHoursThisMonth = useMemo(() => {
        const publishedSchedules = schedules.filter(schedule => schedule.status === 'published');
        const shiftsThisMonth = publishedSchedules.flatMap(s => s.shifts)
            .filter(shift => {
                const shiftDate = new Date(shift.date);
                return shift.assignedUsers.some(u => u.userId === user.uid) &&
                       shiftDate >= monthStart && shiftDate <= monthEnd;
            });
        return calculateTotalHours(shiftsThisMonth.map(s => s.timeSlot));
    }, [schedules, user.uid, monthStart, monthEnd]);
    
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
                        <CardTitle className="text-base">Tháng {format(currentMonth, 'MM/yyyy')}</CardTitle>
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
             <div className="border rounded-md bg-card">
                 {isLoading ? (
                    <div className="h-48 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[35%] text-center">Ngày</TableHead>
                                <TableHead className="text-center">Ca làm việc</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                        {daysWithShifts.length > 0 ? daysWithShifts.map(dateKey => {
                            const shiftsForDay = userShiftsByDate.get(dateKey) || [];
                            if (shiftsForDay.length === 0) return null;
                            
                            const timeSlotsForDay = shiftsForDay.map(s => {
                                const [start, end] = s.timeSlot.split('-');
                                return { start, end };
                            });
                            const dailyTotalHours = calculateTotalHours(timeSlotsForDay);

                            return (
                                <TableRow key={dateKey}>
                                    <TableCell className="font-semibold text-base align-middle text-center">
                                        <p>{format(new Date(dateKey), 'eeee, dd/MM', { locale: vi })}</p>
                                        <p className="text-xs text-muted-foreground font-normal">(Tổng: {dailyTotalHours.toFixed(1)} giờ)</p>
                                    </TableCell>
                                    <TableCell className="align-middle text-center p-2">
                                        <div className="space-y-2 max-w-sm mx-auto">
                                            {shiftsForDay.map((shift, index) => (
                                                 <Card key={index} className="text-left bg-muted text-muted-foreground">
                                                    <CardContent className="p-3">
                                                         <p className="font-semibold text-sm text-foreground">{shift.label}</p>
                                                         <p className="text-xs">{shift.timeSlot}</p>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        }) : (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center text-muted-foreground h-24">
                                    Không có ca làm việc nào trong tháng này.
                                </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
    );
}

export default function UserDetailsDialog({
    isOpen,
    onClose,
    user,
    weekAvailability,
}: {
    isOpen: boolean;
    onClose: () => void;
    user: ManagedUser;
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
                            <TabsTrigger value="availability" className="whitespace-normal"><Clock className="mr-2 h-4 w-4" /> Thời gian rảnh</TabsTrigger>
                            <TabsTrigger value="history" className="whitespace-normal">Lịch sử làm việc</TabsTrigger>
                        </TabsList>
                        <TabsContent value="availability" className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
                            <AvailabilityTab weekAvailability={weekAvailability} />
                        </TabsContent>
                        <TabsContent value="history" className="mt-4 max-h-[70vh] overflow-y-auto pr-2">
                            <HistoryTab user={user} />
                        </TabsContent>
                    </Tabs>
                </div>
            </DialogContent>
        </Dialog>
    );
}
