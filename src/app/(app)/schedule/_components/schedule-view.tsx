
'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getISOWeek, startOfWeek, endOfWeek, addDays, format, eachDayOfInterval, isSameDay, isBefore, isSameWeek } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, UserCheck, Clock, ShieldCheck, Info, CheckCircle, X, MoreVertical, MessageSquareWarning, Send, ArrowRight, ChevronsDownUp } from 'lucide-react';
import type { Schedule, Availability, TimeSlot, AssignedShift, PassRequest, UserRole } from '@/lib/types';
import { cn } from '@/lib/utils';
import AvailabilityDialog from './availability-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function ScheduleView() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [isAvailabilityDialogOpen, setIsAvailabilityDialogOpen] = useState(false);
    const [selectedDateForAvailability, setSelectedDateForAvailability] = useState<Date | null>(null);

    const weekId = useMemo(() => `${currentDate.getFullYear()}-W${getISOWeek(currentDate)}`, [currentDate]);
    
    const daysOfWeek = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [currentDate]);


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
        if (!user) return;

        const currentSchedule = schedule ?? {
            weekId,
            status: 'draft',
            availability: [],
            shifts: [],
        };

        const newAvailability: Availability = {
            userId: user.uid,
            userName: user.displayName,
            date: format(date, 'yyyy-MM-dd'),
            availableSlots: slots,
        };
        
        const availabilityList = currentSchedule.availability || [];
        const existingIndex = availabilityList.findIndex(a => a.userId === user.uid && a.date === newAvailability.date);
        
        const updatedAvailability = [...availabilityList];
        if (existingIndex > -1) {
            updatedAvailability[existingIndex] = newAvailability;
        } else {
            updatedAvailability.push(newAvailability);
        }

        try {
            await dataStore.updateSchedule(weekId, { ...currentSchedule, availability: updatedAvailability });
            toast({ title: 'Thành công', description: 'Đã cập nhật thời gian rảnh của bạn.' });
            
        } catch (error) {
            console.error("Failed to save availability:", error);
            toast({ title: 'Lỗi', description: 'Không thể lưu thời gian rảnh.', variant: 'destructive' });
        }

        setIsAvailabilityDialogOpen(false);
    };

    const handlePassShift = async (shiftId: string) => {
        if (!user || !schedule) return;
        try {
            await dataStore.requestPassShift(weekId, schedule.shifts, shiftId, {userId: user.uid, userName: user.displayName});
            toast({ title: 'Đã gửi yêu cầu', description: 'Yêu cầu pass ca của bạn đã được gửi đến các nhân viên khác.'});
        } catch (error) {
            console.error("Failed to pass shift:", error);
            toast({ title: 'Lỗi', description: 'Không thể gửi yêu cầu pass ca.', variant: 'destructive' });
        }
    }

    const handleTakeShift = async (shift: AssignedShift) => {
        if (!user || !schedule) return;
        const passRequest = shift.passRequests?.find(p => p.status === 'pending');
        if (!passRequest) return;

        try {
            await dataStore.acceptPassShift(weekId, shift.id, passRequest.requestingUser.userId, {userId: user.uid, userName: user.displayName});
            toast({ title: 'Thành công!', description: 'Bạn đã nhận ca làm việc này.'});
        } catch (error: any) {
            console.error("Failed to take shift:", error);
            toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
        }
    }
    
    const userAvailability = useMemo(() => {
        if (!user || !schedule || !Array.isArray(schedule.availability)) {
          return new Map<string, TimeSlot[]>();
        }
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
            .forEach(shift => {
                 if (shift.assignedUsers.some(au => au.userId === user.uid)) {
                    if (!map.has(shift.date)) {
                        map.set(shift.date, []);
                    }
                    map.get(shift.date)!.push(shift);
                }
            });
        return map;
    }, [user, schedule]);


    const weekInterval = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return { start, end };
    }, [currentDate]);
    
    const isCurrentWeek = isSameWeek(currentDate, new Date(), { weekStartsOn: 1 });

    if (authLoading || isLoading) {
        return (
            <div>
                <Skeleton className="h-12 w-1/2 mb-4" />
                <Skeleton className="h-[60vh] w-full" />
            </div>
        )
    }
    
    const startOfThisWeek = startOfWeek(new Date(), {weekStartsOn: 1});
    const canRegisterAvailability = isBefore(startOfThisWeek, weekInterval.start) || isSameDay(startOfThisWeek, weekInterval.start);

    return (
        <div>
            <div className="flex justify-center mb-8">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleDateChange('prev')}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                        <div className="text-center w-48 sm:w-56">
                        <span className="text-base sm:text-lg font-medium whitespace-nowrap">
                            {format(weekInterval.start, 'dd/MM')} - {format(weekInterval.end, 'dd/MM/yyyy')}
                        </span>
                            <Button variant={isCurrentWeek ? "secondary" : "outline"} size="sm" className="w-full mt-1 h-8" onClick={() => setCurrentDate(new Date())}>
                            {isCurrentWeek ? 'Tuần này' : 'Quay về tuần hiện tại'}
                        </Button>
                        </div>
                    <Button variant="outline" size="icon" onClick={() => handleDateChange('next')}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {schedule?.status !== 'published' && (
                <Card className="mb-6 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700/50">
                    <CardHeader className="flex-row items-center gap-4">
                        <Info className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        <div>
                             <CardTitle className="text-blue-800 dark:text-blue-300 text-lg">
                                {schedule?.status === 'draft' && 'Lịch tuần này đang được soạn thảo.'}
                                {schedule?.status === 'proposed' && 'Lịch đã được đề xuất và đang chờ duyệt.'}
                                {!schedule && canRegisterAvailability && 'Chưa có lịch cho tuần này. Vui lòng đăng ký giờ rảnh.'}
                                {!schedule && !canRegisterAvailability && 'Chưa có lịch cho tuần này.'}
                            </CardTitle>
                            <CardDescription className="text-blue-700 dark:text-blue-400/80">
                                Lịch làm việc sẽ hiển thị ở đây sau khi được Chủ nhà hàng công bố.
                            </CardDescription>
                        </div>
                    </CardHeader>
                </Card>
            )}
            
            <div className="overflow-x-auto">
                <div className="grid grid-cols-7 border-t border-l min-w-[700px]">
                    {daysOfWeek.map(day => (
                        <div key={day.toString()} className={cn("p-2 border-b border-r text-center", isSameDay(day, new Date()) && "bg-primary/10")}>
                            <span className="font-bold">{format(day, 'dd')}</span>
                            <span className="text-sm text-muted-foreground ml-2">{format(day, 'eee', { locale: vi })}</span>
                        </div>
                    ))}
                    {daysOfWeek.map(day => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const availabilityForDay = userAvailability.get(dateKey) || [];
                        const shiftsForDay = userShifts.get(dateKey) || [];

                        return (
                            <div key={dateKey} className="border-b border-r min-h-48 flex flex-col p-2 space-y-2">
                                {schedule?.status === 'published' && shiftsForDay.length > 0 && (
                                    <div className="space-y-1">
                                        {shiftsForDay.map(shift => {
                                            return (
                                                <div key={shift.id} className="bg-primary text-primary-foreground p-2 rounded-md text-sm relative group">
                                                    <p className="font-bold">{shift.label}</p>
                                                    <p className="text-xs opacity-90">{shift.timeSlot.start} - {shift.timeSlot.end}</p>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={!!shift.passRequests?.some(p => p.status === 'pending')}>
                                                                        <Send className="mr-2 h-4 w-4 text-blue-500"/> Xin pass ca
                                                                    </DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader><AlertDialogTitle>Xác nhận pass ca?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ gửi yêu cầu pass ca của bạn đến các nhân viên khác. Bạn vẫn có trách nhiệm với ca này cho đến khi có người nhận.</AlertDialogDescription></AlertDialogHeader>
                                                                    <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => handlePassShift(shift.id)}>Xác nhận</AlertDialogAction></AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                                
                                {canRegisterAvailability && (
                                    <Card className="bg-muted/50 hover:bg-muted/80 transition-colors flex-grow">
                                        <CardHeader className="p-2">
                                            <CardTitle className="text-sm font-medium">Giờ rảnh đã đăng ký</CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-2 pt-0">
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
                                
                                {schedule?.shifts.filter(s => s.date === dateKey && s.passRequests?.some(p => p.status === 'pending' && !s.assignedUsers.some(au => au.userId === user?.uid))).map(shift => {
                                    const passRequest = shift.passRequests?.find(p => p.status === 'pending');
                                    if (!passRequest || user?.role !== shift.role) return null;
                                    
                                    return (
                                        <div key={`pass-${shift.id}`} className="bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 p-2 rounded-md text-xs">
                                            <p className="font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
                                                <Badge variant="outline" className="text-amber-700 border-amber-400">{shift.role}</Badge>
                                                {passRequest.requestingUser.userName} muốn pass ca
                                            </p>
                                            <p className="text-muted-foreground text-xs mt-1">{shift.label} ({shift.timeSlot.start} - {shift.timeSlot.end})</p>
                                            <div className="flex gap-2 mt-2">
                                                <Button size="xs" className="h-6" onClick={() => handleTakeShift(shift)}>
                                                    <CheckCircle className="mr-1 h-3 w-3"/> Nhận ca
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })}
                </div>
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
