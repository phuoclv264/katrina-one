
'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getISOWeek, startOfWeek, endOfWeek, addDays, format, eachDayOfInterval, isSameDay, isBefore, isSameWeek, getDay, startOfToday } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, UserCheck, Clock, ShieldCheck, Info, CheckCircle, X, MoreVertical, MessageSquareWarning, Send, ArrowRight, ChevronsDownUp, MailQuestion, Save, Settings, FileSignature } from 'lucide-react';
import type { Schedule, Availability, TimeSlot, AssignedShift, Notification, UserRole, ShiftTemplate, AuthUser, ManagedUser, AssignedUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import AvailabilityDialog from './availability-dialog';
import PassRequestsDialog from './pass-requests-dialog';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import isEqual from 'lodash.isequal';
import { TooltipProvider } from '@/components/ui/tooltip';


export default function ScheduleView() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isAvailabilityDialogOpen, setIsAvailabilityDialogOpen] = useState(false);
    const [isPassRequestsDialogOpen, setIsPassRequestsDialogOpen] = useState(false);
    const [selectedDateForAvailability, setSelectedDateForAvailability] = useState<Date | null>(null);

    const weekId = useMemo(() => `${currentDate.getFullYear()}-W${getISOWeek(currentDate)}`, [currentDate]);
    
    const daysOfWeek = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [currentDate]);

    const canManage = useMemo(() => user?.role === 'Quản lý' || user?.role === 'Chủ nhà hàng', [user]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.replace('/');
            return;
        }

        setIsLoading(true);
        let scheduleSubscribed = false;
        let templatesSubscribed = false;
        let notificationsSubscribed = false;
        let usersSubscribed = false;

        const checkLoadingDone = () => {
            if (scheduleSubscribed && templatesSubscribed && notificationsSubscribed && usersSubscribed) {
                setIsLoading(false);
            }
        };

        const unsubSchedule = dataStore.subscribeToSchedule(weekId, (newSchedule) => {
            setSchedule(newSchedule);
            scheduleSubscribed = true;
            checkLoadingDone();
        });
        
        const unsubTemplates = dataStore.subscribeToShiftTemplates((templates) => {
            const sortedTemplates = templates.sort((a, b) => a.timeSlot.start.localeCompare(b.timeSlot.start));
            setShiftTemplates(sortedTemplates);
            templatesSubscribed = true;
            checkLoadingDone();
        });
        
        const unsubUsers = dataStore.subscribeToUsers((userList) => {
            setAllUsers(userList);
            usersSubscribed = true;
            checkLoadingDone();
        });
        
        let unsubNotifications: () => void;
        if (canManage) {
            unsubNotifications = dataStore.subscribeToAllNotifications((notifs) => {
                setNotifications(notifs);
                notificationsSubscribed = true;
                checkLoadingDone();
            });
        } else {
             unsubNotifications = dataStore.subscribeToRelevantNotifications(user.uid, user.role, (notifs) => {
                setNotifications(notifs);
                notificationsSubscribed = true;
                checkLoadingDone();
            });
        }


        return () => {
            unsubSchedule();
            unsubTemplates();
            unsubNotifications();
            unsubUsers();
        };
    }, [user, authLoading, router, weekId, canManage]);

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

    const handlePassShift = async (shift: AssignedShift) => {
        if (!user || !schedule) return;
        try {
            await dataStore.requestPassShift(shift, user);
            toast({ title: 'Đã gửi yêu cầu', description: 'Yêu cầu pass ca của bạn đã được gửi đến các nhân viên khác.'});
        } catch (error) {
            console.error("Failed to pass shift:", error);
            toast({ title: 'Lỗi', description: 'Không thể gửi yêu cầu pass ca.', variant: 'destructive' });
        }
    }

    const handleTakeShift = async (notification: Notification) => {
        if (!user || !schedule) return;
        
        try {
            const acceptingUser: AssignedUser = { userId: user.uid, userName: user.displayName };
            await dataStore.acceptPassShift(notification, acceptingUser);
            toast({ title: 'Thành công!', description: 'Bạn đã nhận ca làm việc này.'});
        } catch (error: any) {
            console.error("Failed to take shift:", error);
            toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
        }
    }

    const handleDeclineShift = async (notification: Notification) => {
        if (!user) return;
        try {
            await dataStore.declinePassShift(notification.id, user.uid);
            toast({ title: 'Đã từ chối', description: 'Bạn sẽ không thấy lại yêu cầu này.'});
        } catch (error: any) {
            toast({ title: 'Lỗi', description: 'Không thể từ chối yêu cầu.', variant: 'destructive' });
        }
    }

    const handleCancelPassRequest = async (notificationId: string) => {
        if (!user) return;
        try {
            await dataStore.updateNotificationStatus(notificationId, 'cancelled');
             toast({ title: 'Thành công', description: 'Đã hủy yêu cầu pass ca của bạn.'});
        } catch (error: any) {
             toast({ title: 'Lỗi', description: 'Không thể hủy yêu cầu.', variant: 'destructive' });
        }
    }

    const handleRevertRequest = async (notification: Notification) => {
        if (!user) return;
         try {
            await dataStore.revertPassRequest(notification);
            toast({ title: 'Thành công', description: 'Đã hoàn tác yêu cầu pass ca thành công.'});
        } catch (error) {
            console.error(error);
            toast({ title: 'Lỗi', description: 'Không thể hoàn tác yêu cầu.', variant: 'destructive'});
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

    const weekInterval = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return { start, end };
    }, [currentDate]);
    
    const isCurrentWeek = isSameWeek(currentDate, new Date(), { weekStartsOn: 1 });

    const pendingRequestCount = useMemo(() => {
        if (!user) return 0;
        return notifications.filter(n => {
            if (n.type !== 'pass_request' || n.status !== 'pending' || n.payload.requestingUser.userId === user.uid) return false;
            
            const payload = n.payload;
            const isDifferentRole = payload.shiftRole !== 'Bất kỳ' && user.role !== payload.shiftRole;
            const hasDeclined = (payload.declinedBy || []).includes(user.uid);
            
            return !isDifferentRole && !hasDeclined;
        }).length;
    }, [notifications, user]);
    
    const hasPendingRequest = (shiftId: string): boolean => {
        return notifications.some(n => n.payload.shiftId === shiftId && n.status === 'pending');
    }

    if (authLoading || isLoading || !user) {
        return (
            <div>
                <Skeleton className="h-12 w-full sm:w-1/2 mb-4" />
                <Skeleton className="h-[60vh] w-full" />
            </div>
        )
    }
    
    const today = startOfToday();
    const startOfThisWeek = startOfWeek(new Date(), {weekStartsOn: 1});
    const canRegisterAvailability = isBefore(startOfThisWeek, weekInterval.start) || isSameDay(startOfThisWeek, weekInterval.start);
    const isSchedulePublished = schedule?.status === 'published';

    return (
        <TooltipProvider>
            <div className="flex flex-wrap justify-center sm:justify-between items-center gap-4 mb-8">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => handleDateChange('prev')}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                        <div className="text-center">
                        <span className="text-lg font-medium whitespace-nowrap">
                            {format(weekInterval.start, 'dd/MM')} - {format(weekInterval.end, 'dd/MM/yyyy')}
                        </span>
                            <Button variant={isCurrentWeek ? "secondary" : "outline"} size="sm" className="w-full mt-1" onClick={() => setCurrentDate(new Date())}>
                            {isCurrentWeek ? 'Tuần này' : 'Quay về tuần hiện tại'}
                        </Button>
                        </div>
                    <Button variant="outline" size="icon" onClick={() => handleDateChange('next')}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="relative w-full sm:w-auto">
                    <Button variant="outline" onClick={() => setIsPassRequestsDialogOpen(true)} className="w-full">
                        <MailQuestion className="mr-2 h-4 w-4"/>
                        Yêu cầu Pass ca
                    </Button>
                     {pendingRequestCount > 0 && (
                        <Badge className="absolute -top-2 -right-2 px-2">{pendingRequestCount}</Badge>
                    )}
                </div>
            </div>

            {!isSchedulePublished && (
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
            
            <div className="w-full">
                <Table className="table-fixed">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[30%]">Ngày</TableHead>
                            <TableHead>
                                {isSchedulePublished
                                    ? 'Ca làm việc'
                                    : 'Thời gian rảnh'
                                }
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {daysOfWeek.map(day => {
                            const dateKey = format(day, 'yyyy-MM-dd');
                            
                            // For unpublished view
                            const availabilityForDay = userAvailability.get(dateKey) || [];

                            // For published view
                            const shiftsForDay = schedule?.shifts.filter(s => 
                                s.date === dateKey && s.assignedUsers.some(u => u.userId === user?.uid)
                            ).sort((a,b) => a.timeSlot.start.localeCompare(b.timeSlot.start));
                                                        
                            return (
                                <TableRow 
                                    key={dateKey} 
                                    className={cn(
                                        isSameDay(day, today) && "bg-primary/10",
                                        isBefore(day, today) && "text-muted-foreground opacity-70"
                                    )}
                                >
                                    <TableCell className="font-semibold align-top">
                                        <p>{format(day, 'dd/MM')}</p>
                                        <p className="text-sm font-normal">{format(day, 'eeee', { locale: vi })}</p>
                                    </TableCell>
                                    <TableCell className="align-top">
                                        {!isSchedulePublished ? (
                                             canRegisterAvailability && (
                                                <Card className="bg-muted/30 hover:bg-muted/60 transition-colors">
                                                    <CardContent className="p-2">
                                                        {availabilityForDay.length > 0 ? (
                                                            <div className="space-y-1 text-xs">
                                                                {availabilityForDay.map((slot, i) => (
                                                                    <div key={i} className="bg-background p-1.5 rounded text-center">{slot.start} - {slot.end}</div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-center italic">Chưa đăng ký</p>
                                                        )}
                                                        <Button size="sm" variant="link" className="w-full mt-1 h-auto py-1" onClick={() => openAvailabilityDialog(day)}>
                                                            {availabilityForDay.length > 0 ? 'Chỉnh sửa' : 'Đăng ký'}
                                                        </Button>
                                                    </CardContent>
                                                </Card>
                                            )
                                        ) : (
                                            <div className="space-y-2">
                                                {(shiftsForDay && shiftsForDay.length > 0) ? (
                                                    shiftsForDay.map(shift => (
                                                        <div key={shift.id} className="bg-primary text-primary-foreground p-2 rounded-md text-sm relative group">
                                                            <p className="font-bold">{shift.label}</p>
                                                            <p className="text-xs">{shift.timeSlot.start} - {shift.timeSlot.end}</p>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground">
                                                                        <MoreVertical className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent>
                                                                    <AlertDialog>
                                                                        <AlertDialogTrigger asChild>
                                                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={hasPendingRequest(shift.id)}>
                                                                                <Send className="mr-2 h-4 w-4 text-blue-500"/> Xin pass ca
                                                                            </DropdownMenuItem>
                                                                        </AlertDialogTrigger>
                                                                        <AlertDialogContent>
                                                                            <AlertDialogHeader><AlertDialogTitle>Xác nhận pass ca?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ gửi yêu cầu pass ca của bạn đến các nhân viên khác. Bạn vẫn có trách nhiệm với ca này cho đến khi có người nhận.</AlertDialogDescription></AlertDialogHeader>
                                                                            <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => handlePassShift(shift)}>Xác nhận</AlertDialogAction></AlertDialogFooter>
                                                                        </AlertDialogContent>
                                                                    </AlertDialog>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-sm italic">Không có ca</p>
                                                )}
                                            </div>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>


             <AvailabilityDialog 
                isOpen={isAvailabilityDialogOpen}
                onClose={() => setIsAvailabilityDialogOpen(false)}
                onSave={handleSaveAvailability}
                selectedDate={selectedDateForAvailability}
                existingAvailability={selectedDateForAvailability ? userAvailability.get(format(selectedDateForAvailability, 'yyyy-MM-dd')) || [] : []}
            />

            <PassRequestsDialog 
                isOpen={isPassRequestsDialogOpen}
                onClose={() => setIsPassRequestsDialogOpen(false)}
                notifications={notifications}
                currentUser={user}
                allUsers={allUsers}
                onAccept={handleTakeShift}
                onDecline={handleDeclineShift}
                onCancel={handleCancelPassRequest}
                onRevert={handleRevertRequest}
                onAssign={() => { /* TODO */ }}
            />
        </TooltipProvider>
    );
}

