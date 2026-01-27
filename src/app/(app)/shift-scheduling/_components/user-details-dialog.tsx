
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogBody,
    DialogFooter,
    DialogAction,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ManagedUser, Schedule, Availability, AssignedShift, AssignedUser } from '@/lib/types';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { calculateTotalHours } from '@/lib/schedule-utils';
import { Clock, ChevronLeft, ChevronRight, Loader2, Calendar, History, Hourglass, CalendarDays, LayoutGrid } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

function AvailabilityTab({ weekAvailability }: { weekAvailability: Availability[] }) {
    if (weekAvailability.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="bg-muted/30 p-6 rounded-full mb-4">
                    <Calendar className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Không có dữ liệu rảnh</h3>
                <p className="text-xs text-muted-foreground mt-2 max-w-[200px]">Nhân viên này chưa đăng ký thời gian rảnh cho tuần này.</p>
            </div>
        );
    }

    // Sort by date
    const sortedAvailability = weekAvailability.sort((a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime());

    return (
        <div className="space-y-4 pb-4">
            {sortedAvailability.map((avail, idx) => {
                if (avail.availableSlots.length === 0) return null;
                const date = new Date(avail.date as string);
                return (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        key={avail.date as string}
                        className="bg-card border rounded-[1.25rem] overflow-hidden shadow-soft"
                    >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
                                    <CalendarDays className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-extrabold capitalize tracking-tight">
                                        {format(date, 'eeee', { locale: vi })}
                                    </h4>
                                    <p className="text-[10px] sm:text-xs text-muted-foreground/80 font-bold">
                                        Ngày {format(date, 'dd/MM/yyyy')}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap gap-1.5 sm:justify-end">
                                {avail.availableSlots.map((slot, sIdx) => (
                                    <Badge 
                                        key={sIdx} 
                                        variant="secondary" 
                                        className="bg-blue-500/[0.06] text-blue-600 border-blue-200/50 px-3 py-1 rounded-lg text-[11px] font-extrabold flex items-center gap-1.5"
                                    >
                                        <Clock className="h-3 w-3" />
                                        {slot.start} - {slot.end}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                );
            })}
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
        const shiftsMap = new Map<string, { label: string; timeSlot: string; role: string }[]>();
        const publishedSchedules = schedules.filter((s: Schedule) => s.status === 'published');

        publishedSchedules.forEach((schedule: Schedule) => {
            schedule.shifts.forEach((shift: AssignedShift) => {
                const shiftDate = new Date(shift.date);
                if (shift.assignedUsers.some((u: AssignedUser) => u.userId === user.uid) && shiftDate >= monthStart && shiftDate <= monthEnd) {
                    const dateKey = shift.date;
                    if (!shiftsMap.has(dateKey)) {
                        shiftsMap.set(dateKey, []);
                    }
                    shiftsMap.get(dateKey)!.push({
                        label: shift.label,
                        timeSlot: `${shift.timeSlot.start}-${shift.timeSlot.end}`,
                        role: shift.role
                    });
                }
            });
        });
        return shiftsMap;
    }, [schedules, user.uid, monthStart, monthEnd]);

    const daysWithShifts = useMemo(() => {
        return (Array.from(userShiftsByDate.keys()) as string[]).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    }, [userShiftsByDate]);

    const totalHoursThisMonth = useMemo(() => {
        const publishedSchedules = schedules.filter((s: Schedule) => s.status === 'published');
        const shiftsThisMonth = publishedSchedules.flatMap((s: Schedule) => s.shifts)
            .filter((shift: AssignedShift) => {
                const shiftDate = new Date(shift.date);
                return shift.assignedUsers.some((u: AssignedUser) => u.userId === user.uid) &&
                    shiftDate >= monthStart && shiftDate <= monthEnd;
            });
        return calculateTotalHours(shiftsThisMonth.map((s: AssignedShift) => s.timeSlot));
    }, [schedules, user.uid, monthStart, monthEnd]);

    const handleMonthChange = (direction: 'prev' | 'next') => {
        setCurrentMonth((prev: Date) => {
            const newMonth = new Date(prev);
            newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
            return newMonth;
        });
    };

    return (
        <div className="space-y-6 pb-6">
            <div className="bg-primary/[0.03] border border-primary/10 rounded-[1.5rem] p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                    <h4 className="text-sm font-extrabold text-foreground tracking-tight">Tháng {format(currentMonth, 'MM/yyyy')}</h4>
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                        <Clock className="h-3 w-3 text-primary" />
                        Tổng giờ làm: <span className="text-primary">{totalHoursThisMonth.toFixed(1)} giờ</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => handleMonthChange('prev')}
                        className="h-9 w-9 rounded-xl border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button 
                        variant="outline" 
                        size="icon" 
                        onClick={() => handleMonthChange('next')}
                        className="h-9 w-9 rounded-xl border-primary/20 hover:bg-primary/5 hover:text-primary transition-all"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="relative min-h-[200px]">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Đang tải dữ liệu...</p>
                        </div>
                    </div>
                ) : daysWithShifts.length > 0 ? (
                    <div className="space-y-4">
                        {daysWithShifts.map((dateKey: string, idx: number) => {
                            const shiftsForDay = userShiftsByDate.get(dateKey) || [];
                            const timeSlotsForDay = shiftsForDay.map(s => {
                                const [start, end] = s.timeSlot.split('-');
                                return { start, end };
                            });
                            const dailyTotalHours = calculateTotalHours(timeSlotsForDay);
                            const date = new Date(dateKey);

                            return (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    key={dateKey}
                                    className="bg-card border rounded-[1.25rem] overflow-hidden shadow-soft"
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-orange-500/5 flex items-center justify-center shrink-0 border border-orange-500/10">
                                                <History className="h-5 w-5 text-orange-500" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-extrabold capitalize tracking-tight">
                                                    {format(date, 'eeee', { locale: vi })}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-[10px] sm:text-xs text-muted-foreground/80 font-bold">
                                                        {format(date, 'dd/MM/yyyy')}
                                                    </p>
                                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-bold border-muted-foreground/20">
                                                        {dailyTotalHours.toFixed(1)}h
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-2 flex-1 sm:max-w-[240px]">
                                            {shiftsForDay.map((shift: { label: string; timeSlot: string; role: string }, sIdx: number) => (
                                                <div 
                                                    key={sIdx} 
                                                    className="bg-muted/30 rounded-xl p-2.5 border border-border/10 flex items-center justify-between gap-3"
                                                >
                                                    <div className="space-y-0.5">
                                                        <p className="text-[11px] font-extrabold tracking-tight leading-none">{shift.label}</p>
                                                        <p className="text-[10px] text-muted-foreground/70 font-bold">{shift.timeSlot}</p>
                                                    </div>
                                                    <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-bold uppercase tracking-wider bg-background/50">
                                                        {shift.role}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
                        <div className="bg-muted/30 p-8 rounded-full mb-4">
                            <Hourglass className="h-12 w-12 text-muted-foreground/20" />
                        </div>
                        <h3 className="text-base font-extrabold tracking-tight">Không có ca làm việc</h3>
                        <p className="text-xs text-muted-foreground/80 mt-2 max-w-[220px] font-medium leading-relaxed">
                            Nhân viên này chưa có ca làm việc nào được ghi nhận trong tháng {format(currentMonth, 'MM/yyyy')}.
                        </p>
                    </div>
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
    parentDialogTag,
}: {
    isOpen: boolean;
    onClose: () => void;
    user: ManagedUser;
    weekAvailability: Availability[];
    parentDialogTag: string;
}) {
    if (!user) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose} dialogTag="user-details-dialog" parentDialogTag={parentDialogTag}>
            <DialogContent className="max-w-3xl flex flex-col min-h-0 p-0 sm:rounded-[2rem] border-none shadow-2xl">
                <DialogHeader iconkey="user">
                    <DialogTitle>{user.displayName}</DialogTitle>
                    <DialogDescription>
                        Vai trò: <span className="font-bold text-primary">{user.role}</span>
                    </DialogDescription>
                </DialogHeader>

                <DialogBody className="p-0 flex flex-col min-h-0 bg-background overflow-x-hidden">
                    <Tabs defaultValue="availability" className="flex-1 flex flex-col">
                        <div className="px-4 sm:px-6 border-b bg-muted/20">
                            <TabsList className="h-12 bg-transparent p-0 w-full flex">
                                <TabsTrigger 
                                    value="availability" 
                                    className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary h-12 px-1 text-[10px] sm:text-xs font-bold transition-all uppercase tracking-wider inline-flex gap-1.5 items-center justify-center"
                                >
                                    <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
                                    <span>Thời gian rảnh</span>
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="history" 
                                    className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary h-12 px-1 text-[10px] sm:text-xs font-bold transition-all uppercase tracking-wider inline-flex gap-1.5 items-center justify-center"
                                >
                                    <History className="h-3.5 w-3.5 shrink-0" />
                                    <span>Lịch sử làm</span>
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1 min-h-0">
                            <div className="p-4 sm:p-6">
                                <TabsContent value="availability" className="m-0 focus-visible:outline-none ring-0">
                                    <AvailabilityTab weekAvailability={weekAvailability} />
                                </TabsContent>
                                <TabsContent value="history" className="m-0 focus-visible:outline-none ring-0">
                                    <HistoryTab user={user} />
                                </TabsContent>
                            </div>
                        </ScrollArea>
                    </Tabs>
                </DialogBody>

                <DialogFooter variant="muted" className="px-4 sm:px-6 py-4">
                    <DialogAction variant="ghost" onClick={onClose} className="rounded-xl px-12 font-bold h-11 border-2 w-full sm:w-auto">
                        Đóng
                    </DialogAction>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

