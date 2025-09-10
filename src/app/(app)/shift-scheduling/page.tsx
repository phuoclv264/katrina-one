
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from '@/components/ui/card';
import {
    ChevronLeft,
    ChevronRight,
    Users,
    Clock,
    Plus,
    Send,
    CheckCircle,
    FileSignature,
    Eye,
    Settings,
    MoreVertical,
    BookOpen,
    UserCheck,
    ZoomIn,
    ZoomOut,
    UserPlus
} from 'lucide-react';
import {
    getISOWeek,
    startOfWeek,
    endOfWeek,
    addDays,
    format,
    eachDayOfInterval,
    isSameDay,
    parse,
    getDay,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Schedule, AssignedShift, Availability, ManagedUser, TimeSlot, ShiftTemplate } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import AddShiftDialog from './_components/add-shift-dialog';
import ShiftAssignmentPopover from './_components/shift-assignment-popover';
import ShiftTemplatesDialog from './_components/shift-templates-dialog';
import TotalHoursTracker from './_components/total-hours-tracker';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import HistoryAndReportsDialog from './_components/history-reports-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { isUserAvailable } from '@/lib/schedule-utils';
import { ScrollArea } from '@/components/ui/scroll-area';


export default function ShiftSchedulingPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const { toast } = useToast();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
    const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isTemplatesDialogOpen, setIsTemplatesDialogOpen] = useState(false);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

    const weekId = useMemo(() => `${currentDate.getFullYear()}-W${getISOWeek(currentDate)}`, [currentDate]);

    const canManage = useMemo(() => user?.role === 'Quản lý' || user?.role === 'Chủ nhà hàng', [user]);

    useEffect(() => {
        if (authLoading) return;
        if (!user || !canManage) {
            router.replace('/');
            return;
        }

        setIsLoading(true);
        const unsubSchedule = dataStore.subscribeToSchedule(weekId, (newSchedule) => {
            setSchedule(newSchedule ?? { weekId, status: 'draft', availability: [], shifts: [] });
            setIsLoading(false);
        });

        const unsubUsers = dataStore.subscribeToUsers(setAllUsers);
        const unsubTemplates = dataStore.subscribeToShiftTemplates(setShiftTemplates);

        return () => {
            unsubSchedule();
            unsubUsers();
            unsubTemplates();
        };

    }, [user, authLoading, router, weekId, canManage]);
    
    const weekInterval = useMemo(() => {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        const end = endOfWeek(currentDate, { weekStartsOn: 1 });
        return { start, end };
    }, [currentDate]);

    const daysOfWeek = eachDayOfInterval(weekInterval);
    
    // Auto-populate shifts from templates
    useEffect(() => {
        if (!schedule || schedule.status !== 'draft' || !shiftTemplates.length || !daysOfWeek.length) return;

        const shiftsToAdd: AssignedShift[] = [];
        daysOfWeek.forEach(day => {
            const dayOfWeek = getDay(day); // Sunday = 0, Monday = 1, etc.
            const dateKey = format(day, 'yyyy-MM-dd');

            shiftTemplates.forEach(template => {
                if ((template.applicableDays || []).includes(dayOfWeek)) {
                    const doesShiftExist = schedule.shifts.some(s => s.date === dateKey && s.templateId === template.id);
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
            const updatedShifts = [...schedule.shifts, ...shiftsToAdd].sort((a, b) => {
                if (a.date < b.date) return -1;
                if (a.date > b.date) return 1;
                return a.timeSlot.start.localeCompare(b.timeSlot.start);
            });
            dataStore.updateSchedule(weekId, { shifts: updatedShifts });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schedule?.status, shiftTemplates, weekId]);
    


    const handleDateChange = (direction: 'next' | 'prev') => {
        setCurrentDate(current => addDays(current, direction === 'next' ? 7 : -7));
    };
    
    const handleUpdateShiftAssignment = async (shiftId: string, newAssignedUsers: {userId: string, userName: string}[]) => {
        if (!schedule) return;
        const updatedShifts = schedule.shifts.map(shift => 
            shift.id === shiftId ? { ...shift, assignedUsers: newAssignedUsers } : shift
        );
         // If the shift didn't exist before, add it now.
        if (!schedule.shifts.some(s => s.id === shiftId)) {
            const newShift = createShiftFromId(shiftId);
            if (newShift) {
                newShift.assignedUsers = newAssignedUsers;
                updatedShifts.push(newShift);
            }
        }
        await dataStore.updateSchedule(weekId, { shifts: updatedShifts });
    }

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

    const handleDeleteShift = async (shiftId: string) => {
         if (!schedule) return;
        const updatedShifts = schedule.shifts.filter(shift => shift.id !== shiftId);
        await dataStore.updateSchedule(weekId, { shifts: updatedShifts });
        toast({ title: 'Đã xóa', description: 'Đã xóa ca làm việc khỏi lịch.'});
    }
    
     const handleAddShift = async (date: Date, templateId: string) => {
        if (!schedule) return;
        const template = shiftTemplates.find(t => t.id === templateId);
        if (!template) return;

        const dateKey = format(date, 'yyyy-MM-dd');

        const newShift: AssignedShift = {
            id: `shift_${dateKey}_${template.id}`,
            templateId: template.id,
            date: dateKey,
            label: template.label,
            role: template.role,
            timeSlot: template.timeSlot,
            assignedUsers: [],
        };
        
        const updatedShifts = [...schedule.shifts, newShift].sort((a, b) => {
            if (a.date < b.date) return -1;
            if (a.date > b.date) return 1;
            return a.timeSlot.start.localeCompare(b.timeSlot.start);
        });

        await dataStore.updateSchedule(weekId, { shifts: updatedShifts });
    };

    const handleUpdateStatus = async (newStatus: Schedule['status']) => {
        setIsSubmitting(true);
        try {
            await dataStore.updateSchedule(weekId, { status: newStatus });
            toast({ title: 'Thành công!', description: `Đã cập nhật trạng thái lịch thành: ${newStatus}` });
        } catch (error) {
            console.error("Failed to update schedule status:", error);
            toast({ title: 'Lỗi', description: 'Không thể cập nhật trạng thái lịch.', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const availabilityByDay = useMemo(() => {
        const grouped: { [key: string]: Availability[] } = {};
         if (schedule?.availability) {
            for (const avail of schedule.availability) {
                if (!grouped[avail.date]) {
                    grouped[avail.date] = [];
                }
                grouped[avail.date].push(avail);
            }
        }
        return grouped;
    }, [schedule?.availability]);


    if (isLoading || authLoading) {
        return (
            <div className="container mx-auto max-w-7xl p-4 sm:p-6 md:p-8">
                <Skeleton className="h-12 w-1/2 mb-4" />
                <Skeleton className="h-[60vh] w-full" />
            </div>
        )
    }
    
    const canEditSchedule = schedule?.status === 'draft' || user?.role === 'Chủ nhà hàng';

    return (
        <TooltipProvider>
        <div className="container mx-auto max-w-none p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                 <h1 className="text-3xl font-bold font-headline">Xếp lịch & Phê duyệt</h1>
                <p className="text-muted-foreground mt-2">
                    Tạo lịch làm việc, phân công nhân viên, đề xuất và công bố lịch chính thức.
                </p>
            </header>

            <div className="flex flex-col xl:flex-row gap-8">
                {/* Main Schedule View */}
                <div className="flex-1">
                    <Card>
                        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                             <div>
                                <CardTitle>Lịch tuần: {format(weekInterval.start, 'dd/MM')} - {format(weekInterval.end, 'dd/MM/yyyy')}</CardTitle>
                                <CardDescription>Trạng thái: <span className="font-semibold">{schedule?.status || 'chưa tạo'}</span></CardDescription>
                            </div>
                             <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => handleDateChange('prev')}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Tuần này</Button>
                                <Button variant="outline" size="icon" onClick={() => handleDateChange('next')}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
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
                                                
                                                const shiftForCell = schedule?.shifts.find(s => s.date === dateKey && s.templateId === template.id);
                                                
                                                const shiftObject = shiftForCell ?? createShiftFromId(`shift_${dateKey}_${template.id}`);

                                                if (!shiftObject) {
                                                    return <TableCell key={dateKey} className="bg-muted/30" />;
                                                }

                                                return (
                                                    <TableCell key={dateKey} className="p-2 align-top h-24 text-center">
                                                        <ShiftAssignmentPopover
                                                            shift={shiftObject}
                                                            availableUsers={allUsers.filter(u => u.role === shiftObject.role || shiftObject.role === 'Bất kỳ')}
                                                            dailyAvailability={availabilityByDay[dateKey] || []}
                                                            onUpdateAssignment={handleUpdateShiftAssignment}
                                                            onDelete={handleDeleteShift}
                                                            canEdit={canEditSchedule}
                                                        />
                                                    </TableCell>
                                                )
                                            })}
                                        </TableRow>
                                    )})}
                                </TableBody>
                            </Table>
                        </CardContent>
                         <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t">
                            <div className="flex gap-2">
                                {user?.role === 'Chủ nhà hàng' && (
                                    <>
                                        <Button variant="outline" onClick={() => setIsTemplatesDialogOpen(true)}>
                                            <Settings className="mr-2 h-4 w-4"/> Mẫu ca
                                        </Button>
                                         <Button variant="outline" onClick={() => setIsHistoryDialogOpen(true)}>
                                            <BookOpen className="mr-2 h-4 w-4"/> Lịch sử
                                        </Button>
                                    </>
                                )}
                            </div>
                            <div className="flex-1" />
                            {schedule?.status === 'draft' && user?.role === 'Quản lý' && (
                               <Button onClick={() => handleUpdateStatus('proposed')} disabled={isSubmitting}><Send className="mr-2 h-4 w-4"/> Đề xuất lịch</Button>
                            )}
                             {schedule?.status === 'proposed' && user?.role === 'Chủ nhà hàng' && (
                               <div className="flex gap-2">
                                  <Button variant="secondary" onClick={() => handleUpdateStatus('draft')} disabled={isSubmitting}><FileSignature className="mr-2 h-4 w-4"/> Chỉnh sửa lại</Button>
                                  <Button onClick={() => handleUpdateStatus('published')} disabled={isSubmitting}><CheckCircle className="mr-2 h-4 w-4"/> Duyệt và Công bố</Button>
                               </div>
                            )}
                             {schedule?.status === 'published' && user?.role === 'Chủ nhà hàng' && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                         <Button variant="secondary" disabled={isSubmitting}><FileSignature className="mr-2 h-4 w-4"/> Hủy công bố & Chỉnh sửa</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Hủy công bố lịch?</AlertDialogTitle><AlertDialogDescription>Hành động này sẽ thu hồi lịch đã công bố và cho phép bạn chỉnh sửa lại. Nhân viên sẽ không thấy lịch này nữa cho đến khi bạn công bố lại.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>Hủy</AlertDialogCancel><AlertDialogAction onClick={() => handleUpdateStatus('draft')}>Xác nhận</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </CardFooter>
                    </Card>
                </div>
                {/* Side Panel */}
                <div className="w-full xl:w-80 xl:sticky xl:top-4">
                   <TotalHoursTracker schedule={schedule} allUsers={allUsers} />
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
        </div>
        </TooltipProvider>
    )
}
