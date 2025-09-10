
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
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Schedule, AssignedShift, Availability, ManagedUser, ShiftTemplate } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { useToast } from '@/hooks/use-toast';
import ShiftAssignmentPopover from './shift-assignment-popover';
import ShiftTemplatesDialog from './shift-templates-dialog';
import TotalHoursTracker from './total-hours-tracker';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import HistoryAndReportsDialog from './history-reports-dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIsMobile } from '@/hooks/use-mobile';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import isEqual from 'lodash.isequal';


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

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isTemplatesDialogOpen, setIsTemplatesDialogOpen] = useState(false);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
    
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

    useEffect(() => {
        if (!user || !canManage) return;

        setIsLoading(true);
        const unsubSchedule = dataStore.subscribeToSchedule(weekId, (newSchedule) => {
            const fullSchedule = newSchedule ?? { weekId, status: 'draft', availability: [], shifts: [] };
            setServerSchedule(fullSchedule);
            setLocalSchedule(fullSchedule);
            setHasUnsavedChanges(false);
            setIsLoading(false);
        });

        const unsubUsers = dataStore.subscribeToUsers(setAllUsers);
        const unsubTemplates = dataStore.subscribeToShiftTemplates((templates) => {
            const sortedTemplates = templates.sort((a, b) => a.timeSlot.start.localeCompare(b.timeSlot.start));
            setShiftTemplates(sortedTemplates);
        });

        return () => {
            unsubSchedule();
            unsubUsers();
            unsubTemplates();
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

    const handleUpdateStatus = async (newStatus: Schedule['status']) => {
        if (!localSchedule) return;

        // If trying to publish, ensure changes are saved first.
        if (newStatus === 'published' && hasUnsavedChanges) {
            if (!window.confirm("Bạn có thay đổi chưa lưu. Công bố sẽ lưu các thay đổi này và phát hành lịch. Bạn có muốn tiếp tục?")) {
                return;
            }
        }

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
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[250px] sticky left-0 bg-background z-10">Ca làm việc</TableHead>
                                            {daysOfWeek.map(day => (
                                                <TableHead key={day.toString()} className="text-center">
                                                    {format(day, 'eee', { locale: vi })}
                                                    <br />
                                                    {format(day, 'dd/MM')}
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {shiftTemplates.map(template => {
                                            return (
                                            <TableRow key={template.id}>
                                                <TableCell className="font-semibold sticky left-0 bg-background z-10 align-top">
                                                    <p>{template.label}</p>
                                                    <p className="text-xs text-muted-foreground font-normal">{template.timeSlot.start} - {template.timeSlot.end}</p>
                                                    <p className="text-xs text-muted-foreground font-normal">({template.role})</p>
                                                </TableCell>
                                                {daysOfWeek.map(day => {
                                                    const dateKey = format(day, 'yyyy-MM-dd');
                                                    const dayOfWeek = getDay(day);

                                                    if (!(template.applicableDays || []).includes(dayOfWeek)) {
                                                        return <TableCell key={dateKey} className="bg-muted/30" />;
                                                    }
                                                    
                                                    const shiftForCell = localSchedule?.shifts.find(s => s.date === dateKey && s.templateId === template.id);
                                                    const shiftObject = shiftForCell ?? createShiftFromId(`shift_${dateKey}_${template.id}`);

                                                    if (!shiftObject) return <TableCell key={dateKey} className="bg-muted/30" />;

                                                    return (
                                                        <TableCell key={dateKey} className="p-2 align-top h-24 text-center">
                                                            <ShiftAssignmentPopover
                                                                shift={shiftObject}
                                                                availableUsers={allUsers.filter(u => u.role === shiftObject.role || shiftObject.role === 'Bất kỳ')}
                                                                dailyAvailability={availabilityByDay[dateKey] || []}
                                                                onUpdateAssignment={handleUpdateShiftAssignment}
                                                                canEdit={canEditSchedule}
                                                            />
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
                                            <AccordionItem value={dateKey} key={dateKey}>
                                                <AccordionTrigger className="font-semibold text-base p-4 bg-muted/50 rounded-md">
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
                                                    <div className="space-y-3 p-2">
                                                        {applicableTemplates.length > 0 ? applicableTemplates.map(template => {
                                                            const shiftForCell = localSchedule?.shifts.find(s => s.date === dateKey && s.templateId === template.id);
                                                            const shiftObject = shiftForCell ?? createShiftFromId(`shift_${dateKey}_${template.id}`);

                                                            if (!shiftObject) return null;

                                                            return (
                                                                <div key={template.id} className="p-3 border rounded-md">
                                                                    <div className="flex justify-between items-start gap-2">
                                                                        <div>
                                                                            <p className="font-semibold">{template.label}</p>
                                                                            <p className="text-sm text-muted-foreground">{template.timeSlot.start} - {template.timeSlot.end}</p>
                                                                            <p className="text-xs text-muted-foreground">({template.role})</p>
                                                                        </div>
                                                                        <ShiftAssignmentPopover
                                                                            shift={shiftObject}
                                                                            availableUsers={allUsers.filter(u => u.role === shiftObject.role || shiftObject.role === 'Bất kỳ')}
                                                                            dailyAvailability={availabilityByDay[dateKey] || []}
                                                                            onUpdateAssignment={handleUpdateShiftAssignment}
                                                                            canEdit={canEditSchedule}
                                                                        />
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
                            <div className="flex gap-2">
                                {user?.role === 'Chủ nhà hàng' && (
                                    <>
                                        <Button variant="outline" onClick={() => setIsTemplatesDialogOpen(true)}>
                                            <Settings className="mr-2 h-4 w-4"/> Mẫu ca
                                        </Button>
                                         <Button variant="outline" onClick={() => setIsHistoryDialogOpen(true)}>
                                            <History className="mr-2 h-4 w-4"/> Lịch sử
                                        </Button>
                                    </>
                                )}
                            </div>
                            <div className="flex-1" />
                            <div className="flex items-center justify-end gap-4 flex-wrap">
                                {hasUnsavedChanges && (
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                                        </div>
                                        <span className="text-sm text-muted-foreground">Có thay đổi chưa lưu</span>
                                        <Button variant="default" onClick={handleSaveChanges} disabled={isSubmitting}>
                                            <Save className="mr-2 h-4 w-4"/> Lưu thay đổi
                                        </Button>
                                    </div>
                                )}
                                {localSchedule?.status === 'draft' && user?.role === 'Quản lý' && (
                                   <Button onClick={() => handleUpdateStatus('proposed')} disabled={isSubmitting || hasUnsavedChanges}><Send className="mr-2 h-4 w-4"/> Đề xuất lịch</Button>
                                )}
                                
                                {user?.role === 'Chủ nhà hàng' && localSchedule?.status !== 'published' && (
                                    <Button onClick={() => handleUpdateStatus('published')} disabled={isSubmitting}>
                                        <CheckCircle className="mr-2 h-4 w-4"/> Công bố lịch
                                    </Button>
                                )}
                                
                                {user?.role === 'Chủ nhà hàng' && localSchedule?.status === 'published' && (
                                    <AlertDialog>
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
                   <TotalHoursTracker schedule={localSchedule} allUsers={allUsers} />
                </div>
            </div>
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
