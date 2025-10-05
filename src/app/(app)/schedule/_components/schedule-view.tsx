
'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'react-hot-toast';
import { getISOWeek, startOfWeek, endOfWeek, addDays, format, eachDayOfInterval, isSameDay, isBefore, isSameWeek, getDay, startOfToday, parseISO, isWithinInterval } from 'date-fns';
import { vi } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, UserCheck, Clock, ShieldCheck, Info, CheckCircle, X, MoreVertical, MessageSquareWarning, Send, ArrowRight, ChevronsDownUp, MailQuestion, Save, Settings, FileSignature, Loader2, Users } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import isEqual from 'lodash.isequal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { hasTimeConflict } from '@/lib/schedule-utils';
import ShiftInfoDialog from './shift-info-dialog';


export default function ScheduleView() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);

    const [isAvailabilityDialogOpen, setIsAvailabilityDialogOpen] = useState(false);
    const [isPassRequestsDialogOpen, setIsPassRequestsDialogOpen] = useState(false);
    const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
    const [activeShiftForInfo, setActiveShiftForInfo] = useState<AssignedShift | null>(null);
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

        const baseSchedule = schedule ?? {
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
    
        const availabilityList = baseSchedule.availability ?? [];
        const existingIndex = availabilityList.findIndex(a => a.userId === user.uid && a.date === newAvailability.date);
    
        const updatedAvailability = [...availabilityList];
        if (existingIndex > -1) {
            updatedAvailability[existingIndex] = newAvailability;
        } else {
            updatedAvailability.push(newAvailability);
        }
    
        const dataToSave: Schedule = {
            ...baseSchedule,
            status: baseSchedule.status === 'published' ? 'published' : 'draft',
            availability: updatedAvailability,
        };

        try {
            await dataStore.updateSchedule(weekId, dataToSave);
            toast.success('Đã cập nhật thời gian rảnh của bạn.');
        } catch (error) {
            console.error("Failed to save availability:", error);
            toast.error('Không thể lưu thời gian rảnh.');
        }
    
        setIsAvailabilityDialogOpen(false);
    };

    const handlePassShift = async (shift: AssignedShift) => {
        if (!user || !schedule) return;
        try {
            await dataStore.requestPassShift(shift, user);
            toast.success('Yêu cầu pass ca của bạn đã được gửi đến các nhân viên khác.');
        } catch (error: any) {
            console.error("Failed to pass shift:", error);
            const errorMessage = error.message || 'Không thể gửi yêu cầu pass ca.';
            toast.error(errorMessage);
        }
    }
    
    const handleDirectPassRequest = async (shift: AssignedShift, targetUser: ManagedUser) => {
        if (!user) return;
        setIsProcessing(true);
        try {
            await dataStore.requestDirectPassShift(shift, user, targetUser);
            toast.success(`Yêu cầu đổi ca đã được gửi trực tiếp đến ${targetUser.displayName}.`);
        } catch(error: any) {
            console.error("Failed to send direct pass request:", error);
            toast.error(`Không thể gửi yêu cầu: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    }

    const handleTakeShift = async (notification: Notification) => {
        if (!user || !schedule) return;
        
        (window as any).processingNotificationId = notification.id;
        setIsProcessing(true);
        
        try {
            const acceptingUser: AssignedUser = { userId: user.uid, userName: user.displayName };
            
            await dataStore.acceptPassShift(notification.id, notification.payload, acceptingUser, schedule);

            // Optimistically update UI
            setNotifications(prevNotifs => prevNotifs.map(n => {
                if (n.id === notification.id) {
                    return {
                        ...n,
                        status: 'pending_approval',
                        payload: {
                            ...n.payload,
                            takenBy: acceptingUser
                        }
                    };
                }
                return n;
            }));

            toast.success('Yêu cầu nhận ca đã được gửi đi và đang chờ quản lý phê duyệt.');
        } catch (error: any) {
            console.error("Failed to take shift:", error);
            toast.error(error.message);
        } finally {
            setIsProcessing(false);
            delete (window as any).processingNotificationId;
        }
    }

    const handleDeclineShift = async (notification: Notification) => {
        if (!user) return;
        try {
            await dataStore.declinePassShift(notification.id, user.uid);
            toast.success('Đã từ chối. Bạn sẽ không thấy lại yêu cầu này.');
        } catch (error: any) {
            toast.error('Không thể từ chối yêu cầu.');
        }
    }

    const handleCancelPassRequest = async (notificationId: string) => {
        if (!user) return;
        try {
            await dataStore.updateNotificationStatus(notificationId, 'cancelled', user);
             toast.success('Đã hủy yêu cầu pass ca của bạn.');
        } catch (error: any) {
             toast.error('Không thể hủy yêu cầu.');
        }
    }

    const handleRevertRequest = async (notification: Notification) => {
        if (!user) return;
         try {
            await dataStore.revertPassRequest(notification, user);
            toast.success('Đã hoàn tác yêu cầu pass ca thành công.');
        } catch (error) {
            console.error(error);
            toast.error('Không thể hoàn tác yêu cầu.');
        }
    }

     const handleApproveRequest = async (notification: Notification) => {
        if (!user) return;
        (window as any).processingNotificationId = notification.id;
        setIsProcessing(true);
        try {
            await dataStore.approvePassRequest(notification, user);
            toast.success('Đã phê duyệt yêu cầu đổi ca.');
        } catch (error: any) {
            console.error(error);
            let errorMessage = 'Không thể phê duyệt yêu cầu.';
            if (error instanceof Error) {
                if (error.message.includes('SHIFT_CONFLICT:')) {
                    errorMessage = error.message.replace('SHIFT_CONFLICT:', '').trim();
                } else if (error.message.includes('ALREADY_RESOLVED:')) {
                    errorMessage = error.message.replace('ALREADY_RESOLVED:', '').trim();
                }
            }
            toast.error(errorMessage);
        } finally {
            setIsProcessing(false);
            delete (window as any).processingNotificationId;
        }
    }
    
    const handleRejectApproval = async (notificationId: string) => {
         if (!user) return;
        (window as any).processingNotificationId = notificationId;
        setIsProcessing(true);
        try {
            await dataStore.rejectPassRequestApproval(notificationId, user);
            toast.success('Yêu cầu đổi ca đã được trả lại.');
        } catch (error: any) {
            console.error(error);
            toast.error('Không thể từ chối yêu cầu.');
        } finally {
            setIsProcessing(false);
            delete (window as any).processingNotificationId;
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
        if (!notifications || !user) return 0;
        
        const weekFilteredNotifications = notifications.filter(notification => {
            if (notification.type !== 'pass_request') return false;
            const shiftDate = parseISO(notification.payload.shiftDate);
            return isWithinInterval(shiftDate, weekInterval);
        });

        if (canManage) {
            return weekFilteredNotifications.filter(n => n.status === 'pending' || n.status === 'pending_approval').length;
        }

        return weekFilteredNotifications.filter(notification => {
            const payload = notification.payload;
            const isMyRequest = payload.requestingUser.userId === user.uid;

            if (notification.status === 'pending' || notification.status === 'pending_approval') {
                if (isMyRequest) return true;

                if (notification.status === 'pending_approval' && payload.takenBy?.userId === user.uid) {
                    return true;
                }
                
                if (notification.status === 'pending') {
                    const isTargetedToMe = payload.targetUserId === user.uid;
                    const isPublicRequest = !payload.targetUserId;
                    
                    if (isTargetedToMe || isPublicRequest) {
                        const isDifferentRole = payload.shiftRole !== 'Bất kỳ' && user.role !== payload.shiftRole && !(user.secondaryRoles || []).includes(payload.shiftRole as UserRole);
                        const hasDeclined = (payload.declinedBy || []).includes(user.uid);
                        if (!isDifferentRole && !hasDeclined) {
                            return true;
                        }
                    }
                }
            }
            return false;
        }).length;
    }, [notifications, user, weekInterval, canManage]);
    
    const hasPendingRequest = (shiftId: string): boolean => {
        return notifications.some(n => n.payload.shiftId === shiftId && (n.status === 'pending' || n.status === 'pending_approval'));
    }

    if (authLoading || isLoading || !user) {
        return (
            <div>
                <Skeleton className="h-12 w-full sm:w-1/2 mb-4" />
                <div className="border rounded-lg">
                    <Skeleton className="h-[60vh] w-full" />
                </div>
            </div>
        )
    }
    
    const today = startOfToday();
    const canRegisterAvailability = isBefore(today, endOfWeek(currentDate, { weekStartsOn: 1 }));
    const isSchedulePublished = schedule?.status === 'published';

    return (
        <TooltipProvider>
             <div className="flex flex-col sm:flex-row flex-wrap justify-center sm:justify-between items-center gap-4 mb-8">
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
                    <Button variant="secondary" onClick={() => setIsPassRequestsDialogOpen(true)} className="w-full">
                        <MailQuestion className="mr-2 h-4 w-4"/>
                        Yêu cầu Pass ca
                        {pendingRequestCount > 0 && (
                            <Badge variant="destructive" className="ml-2">
                                {pendingRequestCount}
                            </Badge>
                        )}
                    </Button>
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
            
            <div className="border rounded-lg bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[30%] text-center font-bold text-foreground">Ngày</TableHead>
                            <TableHead className="text-center font-bold text-foreground">
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
                                        "border-t",
                                        isSameDay(day, today) && "bg-primary/10",
                                        isBefore(day, today) && "bg-muted/30 text-muted-foreground"
                                    )}
                                >
                                    <TableCell className="font-semibold align-middle text-center w-[30%]">
                                        <p className="text-lg">{format(day, 'dd/MM')}</p>
                                        <p className="text-base font-medium">{format(day, 'eeee', { locale: vi })}</p>
                                    </TableCell>
                                    <TableCell className="align-middle text-center p-2 sm:p-4">
                                        {!isSchedulePublished ? (
                                             canRegisterAvailability && (
                                                <Card className="bg-background transition-colors max-w-sm mx-auto hover:bg-accent/50">
                                                    <CardContent className="p-2">
                                                        {availabilityForDay.length > 0 ? (
                                                            <div className="space-y-1 text-sm">
                                                                {availabilityForDay.map((slot, i) => (
                                                                    <div key={i} className="bg-background p-1.5 rounded text-center">{slot.start} - {slot.end}</div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-center italic">Chưa đăng ký</p>
                                                        )}
                                                        <Button size="sm" variant="link" className="w-full mt-1 h-auto py-1" onClick={() => openAvailabilityDialog(day)}>
                                                            {availabilityForDay.length > 0 ? 'Chỉnh sửa' : 'Đăng ký'}
                                                        </Button>
                                                    </CardContent>
                                                </Card>
                                            )
                                        ) : (
                                            <div className="space-y-2 max-w-sm mx-auto">
                                                {(shiftsForDay && shiftsForDay.length > 0) ? (
                                                    shiftsForDay.map(shift => {
                                                        const shiftEndTime = new Date(`${shift.date}T${shift.timeSlot.end}`);
                                                        const isPastShift = isBefore(shiftEndTime, new Date());
                                                        return (
                                                            <Card 
                                                                key={shift.id} 
                                                                className={cn(
                                                                    "text-left shadow-md",
                                                                    isPastShift 
                                                                        ? "bg-muted text-muted-foreground"
                                                                        : "bg-primary text-primary-foreground"
                                                                )}
                                                            >
                                                                <CardContent className="p-3 flex items-center justify-between gap-2">
                                                                    <div>
                                                                        <p className="font-bold text-base">{shift.label}</p>
                                                                        <p className="text-sm">{shift.timeSlot.start} - {shift.timeSlot.end}</p>
                                                                    </div>
                                                                    {!isPastShift && (
                                                                        <DropdownMenu>
                                                                            <DropdownMenuTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground h-8 w-8">
                                                                                    <MoreVertical className="h-5 w-5" />
                                                                                </Button>
                                                                            </DropdownMenuTrigger>
                                                                            <DropdownMenuContent>
                                                                                <DropdownMenuItem onSelect={() => { setActiveShiftForInfo(shift); setIsInfoDialogOpen(true); }}>
                                                                                    <Users className="mr-2 h-4 w-4 text-blue-500" /> Xem thông tin ca
                                                                                </DropdownMenuItem>
                                                                                <AlertDialog>
                                                                                    <AlertDialogTrigger asChild>
                                                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={hasPendingRequest(shift.id)}>
                                                                                            <Send className="mr-2 h-4 w-4 text-green-500"/> Xin pass ca
                                                                                        </DropdownMenuItem>
                                                                                    </AlertDialogTrigger>
                                                                                    <AlertDialogContent>
                                                                                        <AlertDialogHeader><AlertDialogTitle>Xác nhận pass ca?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ gửi yêu cầu pass ca của bạn đến các nhân viên khác. Bạn vẫn có trách nhiệm với ca này cho đến khi có người nhận và được quản lý phê duyệt.</AlertDialogDescription></AlertDialogHeader>
                                                                                        <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => handlePassShift(shift)}>Xác nhận</AlertDialogAction></AlertDialogFooter>
                                                                                    </AlertDialogContent>
                                                                                </AlertDialog>
                                                                            </DropdownMenuContent>
                                                                        </DropdownMenu>
                                                                    )}
                                                                </CardContent>
                                                            </Card>
                                                        )
                                                    })
                                                ) : (
                                                    <p className="text-sm italic text-center">Không có ca</p>
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
                shiftTemplates={shiftTemplates}
            />

            <PassRequestsDialog 
                isOpen={isPassRequestsDialogOpen}
                onClose={() => setIsPassRequestsDialogOpen(false)}
                notifications={notifications}
                allUsers={allUsers}
                weekInterval={weekInterval}
                onAccept={handleTakeShift}
                onDecline={handleDeclineShift}
                onCancel={handleCancelPassRequest}
                onRevert={handleRevertRequest}
                onAssign={() => { /* Implemented in shift-scheduling */ }}
                onApprove={handleApproveRequest}
                onRejectApproval={handleRejectApproval}
                isProcessing={isProcessing}
                schedule={schedule}
            />
            
            {activeShiftForInfo && schedule && (
                <ShiftInfoDialog
                    isOpen={isInfoDialogOpen}
                    onClose={() => setIsInfoDialogOpen(false)}
                    shift={activeShiftForInfo}
                    schedule={schedule}
                    allUsers={allUsers}
                    onDirectPassRequest={handleDirectPassRequest}
                    isProcessing={isProcessing}
                    notifications={notifications}
                />
            )}
        </TooltipProvider>
    );
}
