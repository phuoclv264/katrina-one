
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
import { format, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { calculateTotalHours } from '@/lib/schedule-utils';
import { Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

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
    const [date, setDate] = useState(new Date());
    
    const userShiftsByDate = useMemo(() => {
        const shiftsMap = new Map<string, { label: string; timeSlot: string }[]>();
        allSchedules.forEach(schedule => {
            if (schedule.status !== 'published') return; // Only count published shifts
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

    const totalHoursThisMonth = useMemo(() => {
        const monthStart = startOfMonth(date);
        const monthEnd = endOfMonth(date);
        const shiftsThisMonth = allSchedules.flatMap(s => s.shifts)
            .filter(shift => {
                if(s.status !== 'published') return false;
                const shiftDate = new Date(shift.date);
                return shift.assignedUsers.some(u => u.userId === user.uid) &&
                       shiftDate >= monthStart && shiftDate <= monthEnd;
            });
        return calculateTotalHours(shiftsThisMonth.map(s => s.timeSlot));
    }, [allSchedules, user.uid, date]);

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader className="p-4">
                    <CardTitle className="text-base">Thống kê tháng {format(date, 'MM/yyyy')}</CardTitle>
                    <CardDescription>
                        Tổng giờ làm: <span className="font-bold text-primary">{totalHoursThisMonth.toFixed(1)} giờ</span>
                    </CardDescription>
                </CardHeader>
            </Card>
             <div className="flex justify-center">
                 <TooltipProvider>
                    <Calendar
                        mode="single"
                        month={date}
                        onMonthChange={setDate}
                        selected={new Date()} // Dummy date
                        className="rounded-md border p-0"
                        classNames={{
                            head_cell: "w-full",
                            day: "h-24 w-full",
                            day_selected: "",
                            day_today: "bg-accent text-accent-foreground",
                        }}
                        components={{
                            DayContent: ({ date: dayDate }) => {
                                const dateKey = format(dayDate, 'yyyy-MM-dd');
                                const shifts = userShiftsByDate.get(dateKey);
                                
                                const dayContent = (
                                    <div className="flex flex-col h-full w-full p-1 text-xs text-left">
                                        <div className={cn("self-start", isSameDay(dayDate, new Date()) && "font-bold")}>{format(dayDate, 'd')}</div>
                                        {shifts && (
                                            <div className="flex-grow mt-1 space-y-0.5 overflow-y-auto">
                                                {shifts.map((shift, i) => 
                                                    <div key={i} className="bg-primary/20 text-primary-foreground rounded-sm px-1.5 py-0.5 leading-tight">
                                                        <p className="font-semibold text-[11px] truncate">{shift.label}</p>
                                                        <p className="text-[10px] opacity-80">{shift.timeSlot}</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );

                                if (shifts && shifts.length > 0) {
                                    return (
                                        <Tooltip>
                                            <TooltipTrigger className="h-full w-full">{dayContent}</TooltipTrigger>
                                            <TooltipContent>
                                                <div className="space-y-1 text-sm">
                                                    {shifts.map((shift, i) => (
                                                        <p key={i}><span className="font-semibold">{shift.label}:</span> {shift.timeSlot}</p>
                                                    ))}
                                                </div>
                                            </TooltipContent>
                                        </Tooltip>
                                    );
                                }
                                
                                return dayContent;
                            }
                        }}
                    />
                 </TooltipProvider>
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

