
'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getISOWeek, startOfWeek, endOfWeek, addDays, format, eachDayOfInterval, isSameDay, parse } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, UserCheck, Clock, ShieldCheck, Info } from 'lucide-react';
import type { Schedule, Availability, TimeSlot, AssignedShift } from '@/lib/types';
import { cn } from '@/lib/utils';
import AvailabilityDialog from './_components/availability-dialog';

export default function SchedulePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [isAvailabilityDialogOpen, setIsAvailabilityDialogOpen] = useState(false);
    const [selectedDateForAvailability, setSelectedDateForAvailability] = useState<Date | null>(null);

    const weekId = useMemo(() => `${currentDate.getFullYear()}-W${getISOWeek(currentDate)}`, [currentDate]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.replace('/');
            return;
        }

        setIsLoading(true);
        const unsubscribe = dataStore.subscribeToSchedule(weekId, (newSchedule) => {
            setSchedule(newSchedule);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, authLoading, router, weekId]);

    const handleDateChange = (direction: 'next' | 'prev') => {
        setCurrentDate(current => addDays(current, direction === 'next' ? 7 : -7));
    };

    const openAvailabilityDialog = (date: Date) => {
        setSelectedDateForAvailability(date);
        setIsAvailabilityDialogOpen(true);
    };

    const handleSaveAvailability = async (date: Date, slots: TimeSlot[]) => {
        if (!user || !schedule) return;

        const newAvailability: Availability = {
            userId: user.uid,
            userName: user.displayName,
            date: format(date, 'yyyy-MM-dd'),
            availableSlots: slots,
        };

        const existingIndex = schedule.availability.findIndex(a => a.userId === user.uid && a.date === newAvailability.date);
        
        const updatedAvailability = [...schedule.availability];
        if (existingIndex > -1) {
            updatedAvailability[existingIndex] = newAvailability;
        } else {
            updatedAvailability.push(newAvailability);
        }

        try {
            await dataStore.updateSchedule(weekId, { availability: updatedAvailability });
            toast({ title: 'Thành công', description: 'Đã cập nhật thời gian rảnh của bạn.' });
        } catch (error) {
            console.error("Failed to save availability:", error);
            toast({ title: 'Lỗi', description: 'Không thể lưu thời gian rảnh.', variant: 'destructive' });
        }

        setIsAvailabilityDialogOpen(false);
    };
    
    const userAvailability = useMemo(() => {
        if (!user || !schedule) return new Map<string, TimeSlot[]>();
        const map = new Map<string, TimeSlot[]>();
        schedule.availability
            .filter(a => a.userId === user.uid)
            .forEach(a => map.set(a.date, a.availableSlots));
        return map;
    }, [user, schedule]);

    const userShifts = useMemo(() => {
        if (!user || !schedule || schedule.status !== 'published') return new Map<string, AssignedShift[]>();
        const map = new Map<string, AssignedShift[]>();
        schedule.shifts
            .filter(s => s.assignedUsers.some(au => au.userId === user.uid))
            .forEach(shift => {
                if (!map.has(shift.date)) {
                    map.set(shift.date, []);
                }
                map.get(shift.date)!.push(shift);
            });
        return map;
    }, [user, schedule]);


    const weekInterval = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return { start, end };
    }, [currentDate]);

    const daysOfWeek = eachDayOfInterval(weekInterval);

    if (authLoading || isLoading) {
        return (
            <div className="container mx-auto p-4 sm:p-6 md:p-8">
                <Skeleton className="h-12 w-1/2 mb-4" />
                <Skeleton className="h-[60vh] w-full" />
            </div>
        )
    }
    
    const isNextWeek = startOfWeek(currentDate, {weekStartsOn: 1}) > startOfWeek(new Date(), { weekStartsOn: 1});


    return (
        <div className="container mx-auto p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline">Lịch làm việc</h1>
                        <p className="text-muted-foreground mt-2">
                           Xem lịch đã được phân công và đăng ký thời gian rảnh cho tuần tới.
                        </p>
                    </div>
                     <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => handleDateChange('prev')}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-lg font-medium w-48 text-center">
                            {format(weekInterval.start, 'dd/MM')} - {format(weekInterval.end, 'dd/MM/yyyy')}
                        </span>
                        <Button variant="outline" size="icon" onClick={() => handleDateChange('next')}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </header>

            {schedule?.status !== 'published' && (
                <Card className="mb-6 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700/50">
                    <CardHeader className="flex-row items-center gap-4">
                        <Info className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        <div>
                             <CardTitle className="text-blue-800 dark:text-blue-300 text-lg">
                                {schedule?.status === 'draft' && 'Lịch tuần này đang được soạn thảo.'}
                                {schedule?.status === 'proposed' && 'Lịch đã được đề xuất và đang chờ duyệt.'}
                                {!schedule && isNextWeek && 'Chưa có lịch cho tuần này. Vui lòng đăng ký giờ rảnh.'}
                                {!schedule && !isNextWeek && 'Chưa có lịch cho tuần này.'}
                            </CardTitle>
                            <CardDescription className="text-blue-700 dark:text-blue-400/80">
                                Lịch làm việc sẽ hiển thị ở đây sau khi được Chủ nhà hàng công bố.
                            </CardDescription>
                        </div>
                    </CardHeader>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-7 border-t border-l">
                {daysOfWeek.map(day => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const availabilityForDay = userAvailability.get(dateKey) || [];
                    const shiftsForDay = userShifts.get(dateKey) || [];

                    return (
                        <div key={dateKey} className="border-b border-r min-h-48 flex flex-col">
                            <div className={cn("p-2 border-b flex justify-between items-center", isSameDay(day, new Date()) && "bg-primary/10")}>
                                <span className="font-bold">{format(day, 'dd')}</span>
                                <span className="text-sm text-muted-foreground">{format(day, 'eee', {locale: vi})}</span>
                            </div>
                            <div className="flex-grow p-2 space-y-2">
                                {schedule?.status === 'published' && shiftsForDay.length > 0 && (
                                    <div className="space-y-1">
                                        {shiftsForDay.map(shift => (
                                             <div key={shift.id} className="bg-primary text-primary-foreground p-2 rounded-md">
                                                <p className="font-bold text-sm">{shift.label}</p>
                                                <p className="text-xs opacity-90">{shift.timeSlot.start} - {shift.timeSlot.end}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {isNextWeek && (
                                     <Card className="bg-muted/50 hover:bg-muted/80 transition-colors">
                                        <CardHeader className="p-3">
                                            <CardTitle className="text-sm font-medium">Giờ rảnh đã đăng ký</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-3 pt-0">
                                            {availabilityForDay.length > 0 ? (
                                                <div className="space-y-1 text-xs">
                                                    {availabilityForDay.map((slot, i) => (
                                                        <div key={i} className="bg-background p-1.5 rounded text-center">{slot.start} - {slot.end}</div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-center text-muted-foreground italic">Chưa đăng ký</p>
                                            )}
                                            <Button size="sm" variant="link" className="w-full mt-1 h-auto py-1" onClick={() => openAvailabilityDialog(day)}>
                                                {availabilityForDay.length > 0 ? 'Chỉnh sửa' : 'Đăng ký'}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
             <AvailabilityDialog 
                isOpen={isAvailabilityDialogOpen}
                onClose={() => setIsAvailabilityDialogOpen(false)}
                onSave={handleSaveAvailability}
                selectedDate={selectedDateForAvailability}
                existingAvailability={selectedDateForAvailability ? userAvailability.get(format(selectedDateForAvailability, 'yyyy-MM-dd')) || [] : []}
            />
        </div>
    );
}
