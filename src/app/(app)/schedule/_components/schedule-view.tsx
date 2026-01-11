'use client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'nextjs-toploader/app';
import { dataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { toast } from '@/components/ui/pro-toast';
import { getISOWeek, getISOWeekYear, startOfWeek, endOfWeek, addDays, format, eachDayOfInterval, isSameDay, isBefore, isSameWeek, getDay, startOfToday, parseISO, isWithinInterval } from 'date-fns';
import { vi } from 'date-fns/locale';
import { 
    ChevronLeft, 
    ChevronRight, 
    UserCheck, 
    Clock, 
    ShieldCheck, 
    Info, 
    CheckCircle, 
    X, 
    MoreVertical, 
    MessageSquareWarning, 
    Send, 
    ArrowRight, 
    ChevronsDownUp, 
    MailQuestion, 
    Save, 
    Settings, 
    FileSignature, 
    Loader2, 
    Users,
    Sun,
    CloudSun,
    Moon,
    CalendarDays,
    Calendar as CalendarIcon,
    LogOut
} from 'lucide-react';
import type { Schedule, Availability, TimeSlot, AssignedShift, Notification, UserRole, ShiftTemplate, AuthUser, ManagedUser, AssignedUser, SimpleUser } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CustomAlertDialog } from '@/components/ui/custom-alert-dialog';
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
import { useSearchParams } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { hasTimeConflict } from '@/lib/schedule-utils';
import ShiftInfoDialog from './shift-info-dialog';
import WeekScheduleDialog from './week-schedule-dialog';
import { getQueryParamWithMobileHashFallback } from '@/lib/url-params';


export default function ScheduleView() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const routerRef = useRef(router);
    const searchParams = useSearchParams();
    const isMobile = useIsMobile();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
    const [availability, setAvailability] = useState<Availability[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingNotificationId, setProcessingNotificationId] = useState<string | null>(null);

    const weekId = useMemo(() => `${getISOWeekYear(currentDate)}-W${getISOWeek(currentDate)}`, [currentDate]);

    const [isAvailabilityDialogOpen, setIsAvailabilityDialogOpen] = useState(false);
    const [isPassRequestsDialogOpen, setIsPassRequestsDialogOpen] = useState(false);
    const [isWeekScheduleDialogOpen, setIsWeekScheduleDialogOpen] = useState(false);
    const [dialogWeekId, setDialogWeekId] = useState<string>("");
    const [dialogSchedule, setDialogSchedule] = useState<Schedule | null>(null);

    useEffect(() => {
        if (isWeekScheduleDialogOpen) {
            setDialogWeekId(weekId);
        }
    }, [isWeekScheduleDialogOpen, weekId]);

    useEffect(() => {
        if (!isWeekScheduleDialogOpen || !dialogWeekId) return;

        const unsubscribe = dataStore.subscribeToSchedule(dialogWeekId, (newSchedule) => {
            setDialogSchedule(newSchedule);
        });
        return () => unsubscribe();
    }, [dialogWeekId, isWeekScheduleDialogOpen]);

    const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
    const [activeShiftForInfo, setActiveShiftForInfo] = useState<AssignedShift | null>(null);
    const [selectedDateForAvailability, setSelectedDateForAvailability] = useState<Date | null>(null);
    const [shiftToPass, setShiftToPass] = useState<AssignedShift | null>(null);

    const [isHandlingConflict, setIsHandlingConflict] = useState(false);
    const [conflictDialog, setConflictDialog] = useState<{ isOpen: boolean; oldRequest: Notification | null; newRequestFn: () => void }>({ isOpen: false, oldRequest: null, newRequestFn: () => { } });

    const daysOfWeek = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [currentDate]);

    const canManage = useMemo(() => user?.role === 'Quản lý' || user?.role === 'Chủ nhà hàng', [user]);

    useEffect(() => {
        routerRef.current = router;
    }, [router]);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            routerRef.current.replace('/');
            return;
        }
        if (user.role === 'Chủ nhà hàng') {
            routerRef.current.replace('/shift-scheduling');
            return;
        }

        setIsLoading(true);
        let scheduleSubscribed = false;
        let templatesSubscribed = false;
        let notificationsSubscribed = false;
        let usersSubscribed = false;
        let availabilitySubscribed = false;

        const checkLoadingDone = () => {
            if (scheduleSubscribed && templatesSubscribed && notificationsSubscribed && usersSubscribed && availabilitySubscribed) {
                setIsLoading(false);
            }
        };

        const unsubSchedule = dataStore.subscribeToSchedule(weekId, (newSchedule) => {
            setSchedule(newSchedule);
            scheduleSubscribed = true;
            checkLoadingDone();
        });

        const unsubAvailability = dataStore.subscribeToAvailabilityForWeek(weekId, (newAvailability) => {
            setAvailability(newAvailability);
            availabilitySubscribed = true;
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
            unsubNotifications = dataStore.subscribeToAllPassRequestNotifications((notifs) => {
                setNotifications(notifs);
                notificationsSubscribed = true;
                checkLoadingDone();
            });
        } else if (user) {
            unsubNotifications = dataStore.subscribeToRelevantPassRequestNotifications(user.uid, user.role, (notifs) => {
                setNotifications(notifs);
                notificationsSubscribed = true;
                checkLoadingDone();
            });
        }


        return () => {
            unsubSchedule();
            unsubAvailability();
            unsubTemplates();
            unsubNotifications();
            unsubUsers();
        };
    }, [user, authLoading, weekId, canManage]);

    useEffect(() => {
        const openPassRequest = getQueryParamWithMobileHashFallback({
            param: 'openPassRequest',
            searchParams,
            hash: typeof window !== 'undefined' ? window.location.hash : '',
        });

        if (openPassRequest === 'true') {
            setIsPassRequestsDialogOpen(true);
            if (!isMobile)
                // Optional: remove the query param from URL without reloading
                routerRef.current.replace('/schedule', { scroll: false });
        }
    }, [searchParams]);

    const handleDateChange = (direction: 'next' | 'prev') => {
        setCurrentDate(current => addDays(current, direction === 'next' ? 7 : -7));
    };

    const openAvailabilityDialog = (date: Date) => {
        setSelectedDateForAvailability(date);
        setIsAvailabilityDialogOpen(true);
    };

    const handleSaveAvailability = useCallback(async (date: Date, slots: TimeSlot[]) => {
        if (!user) return;
        try {
            await dataStore.saveUserAvailability(user.uid, user.displayName, date, slots);
            toast.success('Đã cập nhật thời gian rảnh của bạn.');
            setIsAvailabilityDialogOpen(false);
        } catch (error) {
            console.error("Failed to save availability:", error);
            toast.error('Không thể lưu thời gian rảnh.');
        }
    }, [user]);

    const handlePassShift = async (shift: AssignedShift) => {
        if (!user || !schedule) return;

        try {
            const conflictingRequest = await dataStore.requestPassShift(shift, user);
            if (conflictingRequest) {
                setConflictDialog({
                    isOpen: true,
                    oldRequest: conflictingRequest,
                    newRequestFn: () => handlePassShiftAfterConflict(shift)
                });
                return;
            }
            toast.success('Yêu cầu pass ca của bạn đã được gửi đến các nhân viên khác.');
        } catch (error: any) {
            toast.error(error.message || "Không thể gửi yêu cầu pass ca.");
        }
    }

    const handlePassShiftAfterConflict = async (shift: AssignedShift) => {
        if (!user) return;
        await dataStore.requestPassShift(shift, user);
    }

    const handleDirectPassRequest = async (shift: AssignedShift, targetUser: ManagedUser, isSwap: boolean, targetUserShift: AssignedShift | null) => {
        if (!user) return;

        try {
            const conflictingRequest = await dataStore.requestDirectPassShift(shift, user, targetUser, isSwap, targetUserShift);
            if (conflictingRequest) {
                setConflictDialog({
                    isOpen: true,
                    oldRequest: conflictingRequest,
                    newRequestFn: () => handleDirectPassRequestAfterConflict(shift, targetUser, isSwap, targetUserShift)
                });
                return;
            }

            const actionText = isSwap ? 'đổi ca' : 'nhờ nhận ca';
            toast.success(`Yêu cầu ${actionText} đã được gửi trực tiếp đến ${targetUser.displayName}.`);
        } catch (error: any) {
            toast.error(error.message || "Không thể gửi yêu cầu.");
        }
    }

    const handleDirectPassRequestAfterConflict = async (shift: AssignedShift, targetUser: ManagedUser, isSwap: boolean, targetUserShift: AssignedShift | null) => {
        if (!user) return;
        await dataStore.requestDirectPassShift(shift, user, targetUser, isSwap, targetUserShift);
    }

    const handleTakeShift = async (notification: Notification) => {
        if (!user || !schedule) return;

        setProcessingNotificationId(notification.id);

        try {
            const acceptingUser: SimpleUser = { userId: user.uid, userName: user.displayName || 'N/A' };

            await dataStore.acceptPassShift(notification.id, notification.payload, acceptingUser, allUsers, schedule);

            // Optimistic update UI
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
            setProcessingNotificationId(null);
        }
    }

    const handleDeclineShift = async (notification: Notification) => {
        if (!user) return;
        setProcessingNotificationId(notification.id);
        try {
            await dataStore.declinePassShift(notification, { uid: user.uid, displayName: user.displayName || 'N/A' });
            toast.success('Đã từ chối. Bạn sẽ không thấy lại yêu cầu này.');
        } catch (error: any) {
            toast.error('Không thể từ chối yêu cầu.');
        } finally {
            setProcessingNotificationId(null);
        }
    }

    const handleCancelPassRequest = async (notificationId: string) => {
        if (!user) return;
        try {
            await dataStore.updatePassRequestNotificationStatus(notificationId, 'cancelled', user);
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
        setProcessingNotificationId(notification.id);
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
                } else {
                    errorMessage = error.message;
                }
            }
            toast.error(errorMessage);
        } finally {
            setProcessingNotificationId(null);
        }
    }

    const handleRejectApproval = async (notificationId: string) => {
        if (!user) return;
        setProcessingNotificationId(notificationId);
        try {
            await dataStore.rejectPassRequestApproval(notificationId, user);
            toast.success('Yêu cầu đổi ca đã được trả lại.');
        } catch (error: any) {
            console.error(error);
            toast.error('Không thể từ chối yêu cầu.');
        } finally {
            setProcessingNotificationId(null);
        }
    }

    const userAvailability = useMemo(() => {
        if (!user || !availability) {
            return new Map<string, TimeSlot[]>();
        }
        const map = new Map<string, TimeSlot[]>();
        availability
            .filter(a => a.userId === user.uid)
            .forEach(a => map.set(a.date as string, a.availableSlots));
        return map;
    }, [user, availability]);

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
        return <LoadingPage />;
    }

    const today = startOfToday();
    const canRegisterAvailability = isBefore(today, endOfWeek(currentDate, { weekStartsOn: 1 }));
    const isSchedulePublished = schedule?.status === 'published';

    const getShiftIcon = (startTime: string) => {
        const hour = parseInt(startTime.split(':')[0]);
        if (hour < 12) return <Sun className="h-4 w-4 text-orange-500" />;
        if (hour < 17) return <CloudSun className="h-4 w-4 text-amber-500" />;
        return <Moon className="h-4 w-4 text-indigo-400" />;
    };

    return (
        <TooltipProvider>
            <div className="max-w-4xl mx-auto space-y-6 pb-20 sm:pb-8">
                {/* Header & Navigation Section */}
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2.5">
                                <div className="p-2 bg-primary/10 rounded-xl">
                                    <CalendarDays className="h-6 w-6 text-primary" />
                                </div>
                                Lịch làm việc
                            </h1>
                            <p className="text-muted-foreground text-sm mt-1 font-medium">
                                {isSchedulePublished ? 'Xem và quản lý ca làm việc cá nhân' : 'Đăng ký thời gian rảnh cho tuần tới'}
                            </p>
                        </div>

                        <div className="flex items-center gap-2.5">
                            <Button
                                variant="outline"
                                onClick={() => setIsWeekScheduleDialogOpen(true)}
                                className="flex-1 sm:flex-none h-11 px-5 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 font-bold text-sm"
                            >
                                <Users className="mr-2.5 h-4 w-4 text-blue-500" />
                                Lịch tổng
                            </Button>
                            <div className="relative flex-1 sm:flex-none">
                                <Button
                                    variant="outline"
                                    onClick={() => setIsPassRequestsDialogOpen(true)}
                                    className="w-full h-11 px-5 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 font-bold text-sm"
                                >
                                    <MailQuestion className="mr-2.5 h-4 w-4 text-orange-500" />
                                    Pass ca
                                    {pendingRequestCount > 0 && (
                                        <Badge variant="destructive" className="ml-2.5 px-2 min-w-[22px] h-5.5 justify-center rounded-full animate-pulse border-none font-black text-[10px]">
                                            {pendingRequestCount}
                                        </Badge>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Modern Week Selector */}
                    <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDateChange('prev')}
                            className="h-12 w-12 rounded-[18px] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                        >
                            <ChevronLeft className="h-6 w-6" />
                        </Button>

                        <div className="flex flex-col items-center">
                            <span className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
                                {format(weekInterval.start, 'dd/MM')} — {format(weekInterval.end, 'dd/MM/yyyy')}
                            </span>
                            {!isCurrentWeek ? (
                                <button
                                    onClick={() => setCurrentDate(new Date())}
                                    className="text-[10px] font-black text-primary uppercase tracking-[0.1em] hover:opacity-80 transition-opacity mt-0.5"
                                >
                                    Quay về tuần này
                                </button>
                            ) : (
                                <div className="flex items-center gap-1.5 mt-0.5 px-2.5 py-0.5 bg-green-500/10 rounded-full">
                                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-wider">
                                        Tuần hiện tại
                                    </span>
                                </div>
                            )}
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDateChange('next')}
                            className="h-12 w-12 rounded-[18px] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                        >
                            <ChevronRight className="h-6 w-6" />
                        </Button>
                    </div>
                </div>

                {!isSchedulePublished && (
                    <div className="relative group overflow-hidden rounded-[24px] border border-blue-100 dark:border-blue-900/30 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/5 p-5 sm:p-6 transition-all">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Info className="h-24 w-24 text-blue-600 rotate-12" />
                        </div>
                        <div className="relative flex items-start gap-4">
                            <div className="p-3 bg-blue-500/15 rounded-2xl shadow-inner shrink-0">
                                <Info className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-blue-900 dark:text-blue-200 text-lg font-black tracking-tight">
                                    {schedule?.status === 'draft' ? 'Lịch đang được chuẩn bị' :
                                        schedule?.status === 'proposed' ? 'Lịch đang chờ phê duyệt' :
                                            canRegisterAvailability ? 'Đang nhận đăng ký giờ rảnh' : 'Chưa có lịch tuần này'}
                                </h3>
                                <p className="text-blue-700/70 dark:text-blue-400/70 text-sm font-medium leading-relaxed max-w-lg">
                                    {schedule?.status === 'proposed'
                                        ? 'Lịch làm việc đã được đề xuất và đang chờ Chủ nhà hàng phê duyệt để công bố chính thức.'
                                        : 'Vui lòng cập nhật thời gian rảnh của bạn sớm nhất có thể để Quản lý có thể sắp xếp nhân sự phù hợp.'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    {daysOfWeek.map(day => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const isToday = isSameDay(day, today);
                        const isPastDay = isBefore(day, today) && !isToday;

                        const availabilityForDay = userAvailability.get(dateKey) || [];
                        const shiftsForDay = (schedule?.shifts || []).filter(s =>
                            s.date === dateKey && s.assignedUsers.some(u => u.userId === user?.uid)
                        ).sort((a, b) => a.timeSlot.start.localeCompare(b.timeSlot.start));

                        return (
                            <div
                                key={dateKey}
                                className={cn(
                                    "group relative flex flex-col gap-3 p-4 rounded-3xl border transition-all duration-300",
                                    isToday
                                        ? "bg-white dark:bg-slate-900 border-primary shadow-xl shadow-primary/5 ring-1 ring-primary/20"
                                        : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-black/20",
                                    isPastDay && "opacity-75 grayscale-[0.3]"
                                )}
                            >
                                {/* Header Row: Date & Status Action */}
                                <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-3">
                                    <div className="flex items-center gap-3">
                                        <span className={cn(
                                            "text-3xl font-black tracking-tighter leading-none",
                                            isToday ? "text-primary" : "text-slate-900 dark:text-slate-100"
                                        )}>
                                            {format(day, 'dd')}
                                        </span>
                                        <div className="flex flex-col -space-y-0.5">
                                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                                THÁNG {format(day, 'M')}
                                            </span>
                                            <span className={cn(
                                                "text-xs font-black uppercase tracking-tight",
                                                isToday ? "text-primary/80" : "text-slate-500"
                                            )}>
                                                {format(day, 'eeee', { locale: vi }).toUpperCase()}
                                            </span>
                                        </div>
                                        {isToday && (
                                            <Badge className="bg-primary hover:bg-primary shadow-lg shadow-primary/20 text-[10px] h-5 px-2 uppercase font-black tracking-widest rounded-full border-none">
                                                Hôm nay
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-end">
                                        {!isSchedulePublished ? (
                                            canRegisterAvailability && (
                                                <div className="flex items-center gap-2">
                                                    {availabilityForDay.length > 0 ? (
                                                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                                                            {availabilityForDay.map((slot, i) => (
                                                                <div key={i} className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-[11px] font-black flex items-center gap-1.5 shadow-sm text-slate-700 dark:text-slate-200">
                                                                    <Clock className="h-3 w-3 text-primary" />
                                                                    {slot.start} – {slot.end}
                                                                </div>
                                                            ))}
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="rounded-xl h-8 px-3 text-[10px] font-black hover:bg-primary/5 text-primary transition-all"
                                                                onClick={() => openAvailabilityDialog(day)}
                                                            >
                                                                SỬA GIỜ
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => openAvailabilityDialog(day)}
                                                            className="group/btn h-9 px-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 hover:border-primary/40 hover:text-primary transition-all flex items-center gap-2 font-black text-[11px] uppercase tracking-wider"
                                                        >
                                                            <CalendarIcon className="h-3.5 w-3.5" />
                                                            Đăng ký giờ rảnh
                                                        </button>
                                                    )}
                                                </div>
                                            )
                                        ) : (
                                            shiftsForDay.length === 0 && (
                                                <span className="text-[11px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                                    <ShieldCheck className="h-3.5 w-3.5" /> NGÀY NGHỈ
                                                </span>
                                            )
                                        )}
                                    </div>
                                </div>

                                {/* Staff Schedule: Shifts Grid */}
                                {isSchedulePublished && (
                                    <div className="w-full">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                                            {(shiftsForDay && shiftsForDay.length > 0) ? (
                                                shiftsForDay.map(shift => {
                                                    const shiftEndTime = new Date(`${shift.date}T${shift.timeSlot.end}`);
                                                    const isPastShift = isBefore(shiftEndTime, new Date());
                                                    const myAssignedEntry = shift.assignedUsers.find(u => u.userId === user.uid);
                                                    const myAssignedRole = myAssignedEntry?.assignedRole ?? null;

                                                    return (
                                                        <div
                                                            key={shift.id}
                                                            className={cn(
                                                                "group/shift relative flex flex-col rounded-2xl overflow-hidden transition-all duration-300",
                                                                isPastShift
                                                                    ? "bg-slate-50/50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800"
                                                                    : "bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md ring-1 ring-inset ring-slate-100 dark:ring-slate-800"
                                                            )}
                                                        >
                                                            <div className="p-3 md:p-4 flex items-center justify-between gap-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={cn(
                                                                        "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover/shift:scale-110",
                                                                        isPastShift ? "bg-slate-100 dark:bg-slate-800" : "bg-primary/10"
                                                                    )}>
                                                                        {getShiftIcon(shift.timeSlot.start)}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-2 mb-0.5">
                                                                            <h3 className={cn(
                                                                                "font-black text-[15px] tracking-tight truncate",
                                                                                isPastShift ? "text-slate-400" : "text-slate-900 dark:text-slate-50"
                                                                            )}>
                                                                                {shift.label}
                                                                            </h3>
                                                                            {myAssignedRole && (
                                                                                <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-black border-primary/20 text-primary uppercase tracking-wider bg-primary/5 rounded-md">
                                                                                    {myAssignedRole}
                                                                                </Badge>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                                                            <Clock className="h-3 w-3 text-primary/70" />
                                                                            {shift.timeSlot.start} – {shift.timeSlot.end}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {!isPastShift && (
                                                                    <DropdownMenu modal={false}>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                                                                                <MoreVertical className="h-4 w-4" />
                                                                            </Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="end" className="w-56 p-2 rounded-2xl shadow-xl">
                                                                            <DropdownMenuItem 
                                                                                onSelect={() => { setActiveShiftForInfo(shift); setIsInfoDialogOpen(true); }}
                                                                                className="rounded-xl flex items-center gap-3 py-3 px-4 cursor-pointer"
                                                                            >
                                                                                <Users className="h-4 w-4 text-blue-500" />
                                                                                <span className="font-bold text-sm">Chi tiết ca</span>
                                                                            </DropdownMenuItem>
                                                                            <DropdownMenuItem 
                                                                                onSelect={() => setShiftToPass(shift)}
                                                                                className="rounded-xl flex items-center gap-3 py-3 px-4 focus:bg-red-50 dark:focus:bg-red-950/30 text-red-600 dark:text-red-400 cursor-pointer group/item"
                                                                            >
                                                                                <LogOut className="h-4 w-4" />
                                                                                <span className="font-bold text-sm">Pass ca làm này</span>
                                                                            </DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                )}
                                                            </div>
                                                            {hasPendingRequest(shift.id) && (
                                                                <div className="bg-orange-500/5 px-4 py-2 border-t border-orange-500/10 flex items-center gap-2">
                                                                    <div className="h-1 w-1 rounded-full bg-orange-500 animate-pulse" />
                                                                    <p className="text-[9px] font-black uppercase text-orange-600 dark:text-orange-400 tracking-wider">
                                                                        Đang đợi phản hồi pass ca
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })
                                            ) : (
                                                null
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            <WeekScheduleDialog
                open={isWeekScheduleDialogOpen}
                onOpenChange={setIsWeekScheduleDialogOpen}
                schedule={dialogSchedule}
                allUsers={allUsers}
                shiftTemplates={shiftTemplates}
                initialWeekInterval={weekInterval}
                onWeekChange={setDialogWeekId}
            />

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
                processingNotificationId={processingNotificationId}
                schedule={schedule}
            />

            {activeShiftForInfo && schedule && (
                <ShiftInfoDialog
                    isOpen={isInfoDialogOpen}
                    onClose={() => setIsInfoDialogOpen(false)}
                    shift={activeShiftForInfo}
                    schedule={schedule}
                    allUsers={allUsers} availability={availability}
                    onDirectPassRequest={handleDirectPassRequest}
                    isProcessing={isHandlingConflict || !!processingNotificationId}
                    notifications={notifications}
                />
            )}

            <CustomAlertDialog
                isOpen={!!shiftToPass}
                onOpenChange={(open) => !open && setShiftToPass(null)}
                variant="destructive"
                icon={LogOut}
                title={<>Xác nhận <br/> Pass ca!</>}
                description={
                    <>
                        Bạn có chắc chắn muốn gửi yêu cầu pass ca <span className="font-black text-slate-900 dark:text-slate-200">{shiftToPass?.label}</span> không?
                        <br /><br />
                        Những nhân viên khác có thể nhận ca này của bạn.
                    </>
                }
                cancelText="Quay lại"
                confirmText="Gửi yêu cầu"
                onConfirm={async () => {
                    if (shiftToPass) {
                        await handlePassShift(shiftToPass);
                        setShiftToPass(null);
                    }
                }}
            />

            <CustomAlertDialog 
                isOpen={conflictDialog.isOpen}
                onOpenChange={(open) => { if (!open) setConflictDialog({ isOpen: false, oldRequest: null, newRequestFn: () => { } }) }}
                variant="warning"
                icon={MessageSquareWarning}
                title={<>Yêu cầu bị <br/> Trùng lặp!</>}
                description={
                    <div className="space-y-6">
                        <p>Hệ thống phát hiện bạn đã có một yêu cầu khác đang chờ xử lý cho ca này.</p>
                        {conflictDialog.oldRequest?.payload && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-[28px] border border-slate-100 dark:border-slate-800 ring-1 ring-inset ring-black/5 shadow-inner">
                                <div className="grid grid-cols-2 gap-y-4 text-sm">
                                    <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Loại yêu cầu:</span>
                                    <span className="font-black text-right text-slate-700 dark:text-slate-200">{
                                        conflictDialog.oldRequest.payload.isSwapRequest ? 'Đổi ca'
                                            : conflictDialog.oldRequest.payload.targetUserId ? 'Nhờ nhận ca'
                                                : 'Pass công khai'
                                    }</span>
                                    {conflictDialog.oldRequest.payload.targetUserId && (
                                        <>
                                            <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Người nhận:</span>
                                            <span className="font-black text-right text-slate-700 dark:text-slate-200">{allUsers.find(u => u.uid === conflictDialog.oldRequest!.payload.targetUserId)?.displayName || 'Không rõ'}</span>
                                        </>
                                    )}
                                    <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Trạng thái:</span>
                                    <div className="flex justify-end">
                                        <Badge variant="secondary" className="font-black text-[9px] uppercase tracking-wider bg-slate-200 dark:bg-slate-700 dark:text-slate-300 border-none rounded-lg px-2 shadow-sm">
                                            {conflictDialog.oldRequest.status === 'pending_approval' ? 'Đang chờ duyệt' : 'Đang chờ'}
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="text-center bg-primary/5 p-4 rounded-2xl">
                            <p className="text-sm font-black text-primary/80 leading-relaxed">
                                {conflictDialog.oldRequest?.status === 'pending_approval'
                                    ? "Yêu cầu đã có người nhận nên không thể tự ý hủy bỏ lúc này."
                                    : "Bạn có muốn hủy yêu cầu cũ để thay thế bằng yêu cầu mới không?"
                                }
                            </p>
                        </div>
                    </div>
                }
                cancelText="Đóng"
                confirmText="Hủy cũ & Tạo mới"
                isLoading={isHandlingConflict}
                showConfirm={conflictDialog.oldRequest?.status === 'pending'}
                onConfirm={async () => {
                    setIsHandlingConflict(true);
                    try {
                        if (conflictDialog.oldRequest) {
                            await handleCancelPassRequest(conflictDialog.oldRequest.id);
                        }
                        await new Promise(resolve => setTimeout(resolve, 500));
                        await conflictDialog.newRequestFn();
                    } finally {
                        setIsHandlingConflict(false);
                        setConflictDialog({ isOpen: false, oldRequest: null, newRequestFn: () => { } });
                    }
                }}
                maxWidth="lg"
            />
        </TooltipProvider>
    );
}
