
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
    CardFooter,
} from '@/components/ui/card';
import {
    ChevronLeft,
    ChevronRight,
    Send,
    CheckCircle,
    FileSignature,
    Settings,
    History,
    ChevronsDownUp,
    Save,
    MailQuestion,
    UserPlus,
    Loader2,
} from 'lucide-react';
import {
    getISOWeek,
    startOfWeek,
    endOfWeek,
    addDays,
    format,
    eachDayOfInterval,
    isSameDay,
    getDay,
    isSameWeek,
    isWithinInterval,
    parseISO,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Schedule, AssignedShift, Availability, ManagedUser, ShiftTemplate, Notification } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { useToast } from '@/hooks/use-toast';
import ShiftAssignmentDialog from './shift-assignment-popover'; // Renaming this import for clarity, but it's the right file
import ShiftTemplatesDialog from './shift-templates-dialog';
import TotalHoursTracker from './total-hours-tracker';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import HistoryAndReportsDialog from './history-reports-dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import isEqual from 'lodash.isequal';
import { Badge } from '@/components/ui/badge';
import PassRequestsDialog from '../../schedule/_components/pass-requests-dialog';
import UserDetailsDialog from './user-details-dialog';


export default function ScheduleView() {
    const { user } = useAuth();
    const { toast } = useToast();
    const isMobile = useIsMobile();

    const [currentDate, setCurrentDate] = useState(new Date());
    
    const [serverSchedule, setServerSchedule] = useState<Schedule | null>(null);
    const [localSchedule, setLocalSchedule] = useState<Schedule | null>(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
    const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);
    const [activeShift, setActiveShift] = useState<AssignedShift | null>(null);

    const [isTemplatesDialogOpen, setIsTemplatesDialogOpen] = useState(false);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
    const [isPassRequestsDialogOpen, setIsPassRequestsDialogOpen] = useState(false);
    
    const [isUserDetailsDialogOpen, setIsUserDetailsDialogOpen] = useState(false);
    const [selectedUserForDetails, setSelectedUserForDetails] = useState<ManagedUser | null>(null);

    const weekInterval = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return { start, end };
    }, [currentDate]);

    const daysOfWeek = useMemo(() => eachDayOfInterval(weekInterval), [weekInterval]);

    const [openMobileDays, setOpenMobileDays] = useState<string[]>(
        () => daysOfWeek.map(day => format(day, 'yyyy-MM-dd'))
    );


    const weekId = useMemo(() => `${currentDate.getFullYear()}-W${getISOWeek(currentDate)}`, [currentDate]);

    const canManage = useMemo(() => user?.role === 'Quản lý' || user?.role === 'Chủ nhà hàng', [user]);
    
    const [showPublishConfirm, setShowPublishConfirm] = useState(false);
    const [showRevertConfirm, setShowRevertConfirm] = useState(false);

    // --- Back button handling ---
    useEffect(() => {
        const dialogIsOpen = isAssignmentDialogOpen || isTemplatesDialogOpen || isHistoryDialogOpen || isPassRequestsDialogOpen || showPublishConfirm || showRevertConfirm || isUserDetailsDialogOpen;
        const handler = (e: PopStateEvent) => {
            if (dialogIsOpen) {
                e.preventDefault();
                setIsAssignmentDialogOpen(false);
                setIsTemplatesDialogOpen(false);
                setIsHistoryDialogOpen(false);
                setIsPassRequestsDialogOpen(false);
                setShowPublishConfirm(false);
                setShowRevertConfirm(false);
                setIsUserDetailsDialogOpen(false);
            }
        };

        if (dialogIsOpen) {
            window.history.pushState(null, '', window.location.href);
            window.addEventListener('popstate', handler);
        }

        return () => {
            window.removeEventListener('popstate', handler);
        };
    }, [isAssignmentDialogOpen, isTemplatesDialogOpen, isHistoryDialogOpen, isPassRequestsDialogOpen, showPublishConfirm, showRevertConfirm, isUserDetailsDialogOpen]);


    useEffect(() => {
        if (!user || !canManage) return;

        setIsLoading(true);
        const unsubSchedule = dataStore.subscribeToSchedule(weekId, (newSchedule) => {
            const fullSchedule = newSchedule ?? { weekId, status: 'draft', availability: [], shifts: [] };
            setServerSchedule(fullSchedule);
            setLocalSchedule(fullSchedule);
            setHasUnsavedChanges(false);
        });

        const unsubUsers = dataStore.subscribeToUsers(setAllUsers);
        const unsubTemplates = dataStore.subscribeToShiftTemplates((templates) => {
            const sortedTemplates = templates.sort((a, b) => a.timeSlot.start.localeCompare(b.timeSlot.start));
            setShiftTemplates(sortedTemplates);
        });

        const unsubNotifications = dataStore.subscribeToAllNotifications(setNotifications);


        Promise.all([
            new Promise(resolve => setTimeout(() => resolve(true), 500)) 
        ]).then(() => setIsLoading(false));


        return () => {
            unsubSchedule();
            unsubUsers();
            unsubTemplates();
            unsubNotifications();
        };

    }, [user, weekId, canManage]);
    
    // Check for unsaved changes before leaving the page
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = ''; // Required for legacy browsers
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);


    // Auto-populate shifts from templates
    useEffect(() => {
        if (!localSchedule || localSchedule.status !== 'draft' || !shiftTemplates.length) return;

        const shiftsToAdd: AssignedShift[] = [];
        const daysInWeek = eachDayOfInterval({start: startOfWeek(currentDate, {weekStartsOn: 1}), end: endOfWeek(currentDate, {weekStartsOn: 1})})
        
        daysInWeek.forEach(day => {
            const dayOfWeek = getDay(day);
            const dateKey = format(day, 'yyyy-MM-dd');

            shiftTemplates.forEach(template => {
                if ((template.applicableDays || []).includes(dayOfWeek)) {
                    const doesShiftExist = localSchedule.shifts.some(s => s.date === dateKey && s.templateId === template.id);
                    if (!doesShiftExist) {
                        shiftsToAdd.push({
                            id: `shift_${dateKey}_${template.id}`,
                            templateId: template.id,
                            date: dateKey,
                            label: template.label,
                            role: template.role,
                            timeSlot: template.timeSlot,
                            assignedUsers: [],
                        });
                    }
                }
            });
        });

        if (shiftsToAdd.length > 0) {
            const updatedShifts = [...localSchedule.shifts, ...shiftsToAdd].sort((a, b) => {
                if (a.date < b.date) return -1;
                if (a.date > b.date) return 1;
                return a.timeSlot.start.localeCompare(b.timeSlot.start);
            });
            handleLocalScheduleUpdate({ shifts: updatedShifts });
        }
    }, [localSchedule?.status, shiftTemplates, weekId, currentDate, localSchedule]);

    const handleLocalScheduleUpdate = useCallback((data: Partial<Schedule>) => {
        setLocalSchedule(prev => {
            if (!prev) return null;
            const newSchedule = { ...prev, ...data };
            setHasUnsavedChanges(!isEqual(newSchedule, serverSchedule));
            return newSchedule;
        });
    }, [serverSchedule]);


    const handleDateChange = (direction: 'next' | 'prev') => {
        if (hasUnsavedChanges) {
            if (!window.confirm("Bạn có các thay đổi chưa được lưu. Bạn có chắc muốn chuyển tuần?")) {
                return;
            }
        }
        setCurrentDate(current => addDays(current, direction === 'next' ? 7 : -7));
    };
    
    const handleUpdateShiftAssignment = useCallback((shiftId: string, newAssignedUsers: {userId: string, userName: string}[]) => {
        if (!localSchedule) return;
        
        let updatedShifts;
        const shiftExists = localSchedule.shifts.some(s => s.id === shiftId);

        if (shiftExists) {
            updatedShifts = localSchedule.shifts.map(shift => 
                shift.id === shiftId ? { ...shift, assignedUsers: newAssignedUsers } : shift
            );
        } else {
             const newShift = createShiftFromId(shiftId);
             if (newShift) {
                newShift.assignedUsers = newAssignedUsers;
                updatedShifts = [...localSchedule.shifts, newShift];
            } else {
                updatedShifts = [...localSchedule.shifts];
            }
        }
        handleLocalScheduleUpdate({ shifts: updatedShifts });
    }, [localSchedule, handleLocalScheduleUpdate]);

    const handleSaveChanges = async () => {
        if (!localSchedule || !hasUnsavedChanges) return;
        setIsSubmitting(true);
        try {
            await dataStore.updateSchedule(weekId, localSchedule);
            toast({ title: "Đã lưu!", description: "Lịch làm việc đã được cập nhật." });
            setHasUnsavedChanges(false);
            setServerSchedule(localSchedule); // Sync server state with local
        } catch (error) {
            console.error("Failed to save changes:", error);
            toast({ title: 'Lỗi', description: 'Không thể lưu thay đổi.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const createShiftFromId = (shiftId: string): AssignedShift | null => {
        const parts = shiftId.split('_');
        if (parts.length < 3) return null;
        const [_, dateKey, ...templateIdParts] = parts;
        const templateId = templateIdParts.join('_');
        
        const template = shiftTemplates.find(t => t.id === templateId);
        if (!template) return null;

        return {
            id: shiftId,
            templateId: template.id,
            date: dateKey,
            label: template.label,
            role: template.role,
            timeSlot: template.timeSlot,
            assignedUsers: [],
        };
    };
    
    const handleOpenAssignmentDialog = (shift: AssignedShift) => {
        setActiveShift(shift);
        setIsAssignmentDialogOpen(true);
    };

    const handleUpdateStatus = async (newStatus: Schedule['status']) => {
        if (!localSchedule) return;

        // If trying to publish, ensure changes are saved first.
        if (newStatus === 'published' && hasUnsavedChanges) {
            if (!window.confirm("Bạn có thay đổi chưa lưu. Công bố sẽ lưu các thay đổi này và phát hành lịch. Bạn có muốn tiếp tục?")) {
                return;
            }
        }
        
        setShowPublishConfirm(false);
        setShowRevertConfirm(false);

        setIsSubmitting(true);
        try {
            const dataToUpdate = { ...localSchedule, status: newStatus };
            await dataStore.updateSchedule(weekId, dataToUpdate);
            toast({ title: 'Thành công!', description: `Đã cập nhật trạng thái lịch thành: ${newStatus}` });
            setHasUnsavedChanges(false); // Changes are now saved
        } catch (error) {
            console.error("Failed to update schedule status:", error);
            toast({ title: 'Lỗi', description: 'Không thể cập nhật trạng thái lịch.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const availabilityByDay = useMemo(() => {
        const grouped: { [key: string]: Availability[] } = {};
         if (localSchedule?.availability) {
            for (const avail of localSchedule.availability) {
                if (!grouped[avail.date]) {
                    grouped[avail.date] = [];
                }
                grouped[avail.date].push(avail);
            }
        }
        return grouped;
    }, [localSchedule?.availability]);

    const handleToggleAllMobileDays = () => {
        if (openMobileDays.length === daysOfWeek.length) {
            setOpenMobileDays([]);
        } else {
            setOpenMobileDays(daysOfWeek.map(day => format(day, 'yyyy-MM-dd')));
        }
    };
    
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

    const pendingRequestCount = useMemo(() => {
        if (!notifications) return 0;
        // Manager sees all pending requests
        return notifications.filter(n => n.status === 'pending').length;
    }, [notifications]);

    const handleUserClick = (user: ManagedUser) => {
        setSelectedUserForDetails(user);
        setIsUserDetailsDialogOpen(true);
    };

    if (isLoading) {
        return (
            <div className="container mx-auto max-w-7xl p-4 sm:p-6 md:p-8">
                <Skeleton className="h-12 w-1/2 mb-4" />
                <Skeleton className="h-[60vh] w-full" />
            </div>
        )
    }
    
    const canEditSchedule = localSchedule?.status === 'draft' || user?.role === 'Chủ nhà hàng';
    const isCurrentWeek = isSameWeek(currentDate, new Date(), { weekStartsOn: 1 });
    const areAllMobileDaysOpen = openMobileDays.length === daysOfWeek.length;

    // Logic for the Floating Action Button
    let fabAction: (() => void) | null = null;
    let fabIcon: React.ReactNode | null = null;
    let fabLabel: string | null = null;
    let isFabVisible = false;
    let isPublishAction = false;

    if (hasUnsavedChanges) {
        fabAction = handleSaveChanges;
        fabIcon = <Save className="h-6 w-6" />;
        fabLabel = 'Lưu thay đổi';
        isFabVisible = true;
    } else if (user?.role === 'Quản lý' && localSchedule?.status === 'draft') {
        fabAction = () => handleUpdateStatus('proposed');
        fabIcon = <Send className="h-6 w-6" />;
        fabLabel = 'Đề xuất lịch';
        isFabVisible = true;
    } else if (user?.role === 'Chủ nhà hàng' && localSchedule?.status !== 'published') {
        fabAction = () => setShowPublishConfirm(true);
        fabIcon = <CheckCircle className="h-6 w-6" />;
        fabLabel = 'Công bố lịch';
        isFabVisible = true;
        isPublishAction = true;
    }


    return (
        <TooltipProvider>
            <div className="flex flex-col xl:flex-row gap-8">
                {/* Main Schedule View */}
                <div className="flex-1">
                    <Card>
                        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                             <div>
                                <CardTitle>Lịch tuần: {format(weekInterval.start, 'dd/MM')} - {format(weekInterval.end, 'dd/MM/yyyy')}</CardTitle>
                                <CardDescription>Trạng thái: <span className="font-semibold">{localSchedule?.status || 'chưa tạo'}</span></CardDescription>
                            </div>
                             <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => handleDateChange('prev')}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button variant={isCurrentWeek ? "secondary" : "outline"} size="sm" onClick={() => setCurrentDate(new Date())}>Tuần này</Button>
                                <Button variant="outline" size="icon" onClick={() => handleDateChange('next')}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                             {/* Desktop View */}
                            <div className="overflow-x-auto hidden md:block">
                                <Table className="table-fixed w-full border">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-36 font-bold text-center">Ngày</TableHead>
                                            {shiftTemplates.map(template => (
                                                <TableHead key={template.id} className="text-center font-bold border-l">
                                                    <p>{template.label}</p>
                                                    <p className="text-xs text-muted-foreground font-normal">{template.timeSlot.start} - {template.timeSlot.end}</p>
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {daysOfWeek.map(day => {
                                            const dateKey = format(day, 'yyyy-MM-dd');
                                            return (
                                            <TableRow key={dateKey} className="border-t">
                                                <TableCell className="font-semibold align-top text-center">
                                                    <p>{format(day, 'eee, dd/MM', { locale: vi })}</p>
                                                </TableCell>
                                                {shiftTemplates.map(template => {
                                                    const dayOfWeek = getDay(day);

                                                    if (!(template.applicableDays || []).includes(dayOfWeek)) {
                                                        return <TableCell key={template.id} className="bg-muted/30 border-l" />;
                                                    }
                                                    
                                                    const shiftForCell = localSchedule?.shifts.find(s => s.date === dateKey && s.templateId === template.id);
                                                    const shiftObject = shiftForCell ?? createShiftFromId(`shift_${dateKey}_${template.id}`);

                                                    if (!shiftObject) return <TableCell key={template.id} className="bg-muted/30 border-l" />;

                                                    return (
                                                        <TableCell key={template.id} className="p-1 align-top h-28 text-center border-l">
                                                            <Button 
                                                                variant="ghost" 
                                                                className="h-full w-full flex flex-col items-center justify-center p-1 group"
                                                                onClick={() => handleOpenAssignmentDialog(shiftObject)}
                                                                disabled={!canEditSchedule}
                                                            >
                                                                {shiftObject.assignedUsers.length === 0 ? (
                                                                    <div className="text-muted-foreground group-hover:text-primary">
                                                                        <UserPlus className="h-6 w-6 mx-auto" />
                                                                        <span className="text-xs mt-1">Thêm</span>
                                                                    </div>
                                                                ) : (
                                                                     <div className="flex-grow space-y-1 py-1 w-full">
                                                                        {shiftObject.assignedUsers.map(user => (
                                                                            <Badge key={user.userId} variant="secondary" className="block text-xs text-center truncate w-full">
                                                                                {user.userName}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </Button>
                                                        </TableCell>
                                                    )
                                                })}
                                            </TableRow>
                                        )})}
                                    </TableBody>
                                </Table>
                            </div>
                             {/* Mobile View */}
                             <div className="block md:hidden space-y-2">
                                <div className="flex justify-end">
                                    <Button variant="outline" size="sm" onClick={handleToggleAllMobileDays}>
                                        <ChevronsDownUp className="mr-2 h-4 w-4" />
                                        {areAllMobileDaysOpen ? 'Thu gọn tất cả' : 'Mở rộng tất cả'}
                                    </Button>
                                </div>
                                <Accordion type="multiple" value={openMobileDays} onValueChange={setOpenMobileDays}>
                                    {daysOfWeek.map(day => {
                                        const dateKey = format(day, 'yyyy-MM-dd');
                                        const applicableTemplates = shiftTemplates.filter(t => (t.applicableDays || []).includes(getDay(day)));
                                        const shiftsForDay = localSchedule?.shifts.filter(s => s.date === dateKey && s.assignedUsers.length > 0) || [];
                                        
                                        return (
                                            <AccordionItem value={dateKey} key={dateKey} className="border-b">
                                                <AccordionTrigger className="font-semibold text-base p-4 bg-muted/30 rounded-t-md">
                                                     <div className="flex flex-col items-start text-left">
                                                        <span>{format(day, 'eeee, dd/MM', { locale: vi })}</span>
                                                         {openMobileDays.includes(dateKey) ? null : (
                                                            <div className="mt-2 text-xs font-normal text-muted-foreground space-y-1">
                                                                {shiftsForDay.length > 0 ? shiftsForDay.map(shift => (
                                                                    <div key={shift.id}>
                                                                        <span className="font-medium text-foreground">{shift.label}:</span> {shift.assignedUsers.map(u => u.userName).join(', ')}
                                                                    </div>
                                                                )) : <p>Chưa xếp lịch</p>}
                                                            </div>
                                                        )}
                                                     </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="pt-2">
                                                    <div className="space-y-3 p-2 border border-t-0 rounded-b-md">
                                                        {applicableTemplates.length > 0 ? applicableTemplates.map(template => {
                                                            const shiftForCell = localSchedule?.shifts.find(s => s.date === dateKey && s.templateId === template.id);
                                                            const shiftObject = shiftForCell ?? createShiftFromId(`shift_${dateKey}_${template.id}`);

                                                            if (!shiftObject) return null;

                                                            return (
                                                                <div key={template.id} className="p-3 border rounded-md bg-card">
                                                                    <div className="flex justify-between items-start gap-2">
                                                                        <div>
                                                                            <p className="font-semibold">{template.label}</p>
                                                                            <p className="text-sm text-muted-foreground">{template.timeSlot.start} - {template.timeSlot.end}</p>
                                                                            <p className="text-xs text-muted-foreground">({template.role})</p>
                                                                        </div>
                                                                        <Button 
                                                                            variant="secondary"
                                                                            size="sm"
                                                                            onClick={() => handleOpenAssignmentDialog(shiftObject)}
                                                                            disabled={!canEditSchedule}
                                                                            className="bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-200 dark:hover:bg-blue-900"
                                                                        >
                                                                            <UserPlus className="mr-2 h-4 w-4" />
                                                                            Phân công
                                                                        </Button>
                                                                    </div>
                                                                     <div className="flex flex-wrap gap-1 mt-2">
                                                                        {shiftObject.assignedUsers.map(user => (
                                                                            <Badge key={user.userId} variant="secondary">
                                                                                {user.userName}
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }) : (
                                                            <p className="text-sm text-muted-foreground text-center py-4">Không có ca làm việc.</p>
                                                        )}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        )
                                    })}
                                 </Accordion>
                             </div>
                        </CardContent>
                         <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t">
                            <div className="w-full sm:w-auto flex items-center gap-2">
                                {user?.role === 'Chủ nhà hàng' && (
                                    <Button variant="outline" onClick={() => setIsTemplatesDialogOpen(true)} className="flex-1 sm:flex-none">
                                        <Settings className="mr-2 h-4 w-4"/> Mẫu ca
                                    </Button>
                                )}
                                <Button variant="outline" onClick={() => setIsHistoryDialogOpen(true)} className="flex-1 sm:flex-none">
                                    <History className="mr-2 h-4 w-4"/> Lịch sử
                                </Button>
                            </div>
                            <div className="w-full sm:w-auto relative">
                                <Button variant="outline" onClick={() => setIsPassRequestsDialogOpen(true)} className="w-full">
                                    <MailQuestion className="mr-2 h-4 w-4"/> Yêu cầu Pass ca
                                </Button>
                                 {pendingRequestCount > 0 && (
                                    <div className="absolute -top-2 -right-2 flex h-5 w-5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <Badge className="relative px-2">{pendingRequestCount}</Badge>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1" />
                            <div className="flex items-center justify-end gap-4 flex-wrap">
                                 {user?.role === 'Chủ nhà hàng' && localSchedule?.status === 'published' && !hasUnsavedChanges && (
                                    <AlertDialog open={showRevertConfirm} onOpenChange={setShowRevertConfirm}>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="secondary" disabled={isSubmitting}>
                                                <FileSignature className="mr-2 h-4 w-4"/> Thu hồi lịch
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Thu hồi lịch đã công bố?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Hành động này sẽ thu hồi lịch, ẩn nó khỏi trang của nhân viên và chuyển về trạng thái 'Bản nháp' để bạn có thể tiếp tục chỉnh sửa.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleUpdateStatus('draft')}>Xác nhận thu hồi</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}
                            </div>
                        </CardFooter>
                    </Card>
                </div>
                {/* Side Panel */}
                <div className="w-full xl:w-80 xl:sticky xl:top-4">
                   <TotalHoursTracker 
                        schedule={localSchedule} 
                        allUsers={allUsers}
                        onUserClick={handleUserClick}
                    />
                </div>
            </div>

             {isFabVisible && (
                <div className="fixed bottom-4 right-4 z-50 md:bottom-6 md:right-6">
                    <div className="relative">
                        {isPublishAction ? (
                             <AlertDialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        size="lg"
                                        className="rounded-full shadow-lg h-16 w-auto px-6"
                                        disabled={isSubmitting}
                                        aria-label={fabLabel!}
                                    >
                                        {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : fabIcon}
                                        <span className="ml-2 text-base">{fabLabel}</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Công bố lịch làm việc?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ công bố lịch cho tất cả nhân viên. Nếu có thay đổi chưa lưu, chúng cũng sẽ được lưu lại.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => handleUpdateStatus('published')}>Xác nhận Công bố</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        ) : (
                            <Button
                                size="lg"
                                className="rounded-full shadow-lg h-16 w-auto px-6"
                                onClick={fabAction!}
                                disabled={isSubmitting}
                                aria-label={fabLabel!}
                            >
                                {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : fabIcon}
                                <span className="ml-2 text-base">{fabLabel}</span>
                            </Button>
                        )}
                        
                        {hasUnsavedChanges && (
                            <div className="absolute -top-1 -right-1 flex h-4 w-4">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-background"></span>
                            </div>
                        )}
                    </div>
                </div>
            )}
           

            {activeShift && (
                <ShiftAssignmentDialog
                    isOpen={isAssignmentDialogOpen}
                    onClose={() => setIsAssignmentDialogOpen(false)}
                    shift={activeShift}
                    allUsers={allUsers}
                    dailyAvailability={availabilityByDay[activeShift.date] || []}
                    onSave={handleUpdateShiftAssignment}
                    allShiftsOnDay={localSchedule?.shifts.filter(s => s.date === activeShift.date) || []}
                />
            )}

            <PassRequestsDialog
                isOpen={isPassRequestsDialogOpen}
                onClose={() => setIsPassRequestsDialogOpen(false)}
                notifications={notifications}
                currentUser={user!}
                allUsers={allUsers}
                weekInterval={weekInterval}
                onAccept={() => { /* TODO */ }}
                onDecline={() => {}}
                onCancel={handleCancelPassRequest}
                onRevert={handleRevertRequest}
                onAssign={() => { /* TODO */ }}
            />
            
            {selectedUserForDetails && (
                <UserDetailsDialog
                    isOpen={isUserDetailsDialogOpen}
                    onClose={() => setIsUserDetailsDialogOpen(false)}
                    user={selectedUserForDetails}
                    weekAvailability={localSchedule?.availability.filter(a => a.userId === selectedUserForDetails.uid) || []}
                />
            )}

            {user?.role === 'Chủ nhà hàng' && (
                <>
                    <ShiftTemplatesDialog
                        isOpen={isTemplatesDialogOpen}
                        onClose={() => setIsTemplatesDialogOpen(false)}
                    />
                    <HistoryAndReportsDialog
                        isOpen={isHistoryDialogOpen}
                        onClose={() => setIsHistoryDialogOpen(false)}
                        allUsers={allUsers}
                    />
                </>
            )}
        </TooltipProvider>
    )
}
