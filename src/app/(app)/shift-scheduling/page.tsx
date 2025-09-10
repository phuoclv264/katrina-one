
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
    ZoomOut
} from 'lucide-react';
import {
    getISOWeek,
    startOfWeek,
    endOfWeek,
    addDays,
    format,
    eachDayOfInterval,
    isSameDay,
    parse
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { isUserAvailable } from '@/lib/schedule-utils';


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

    const [isAddShiftDialogOpen, setIsAddShiftDialogOpen] = useState(false);
    const [isTemplatesDialogOpen, setIsTemplatesDialogOpen] = useState(false);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
    const [selectedDateForShift, setSelectedDateForShift] = useState<Date | null>(null);

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

    const handleDateChange = (direction: 'next' | 'prev') => {
        setCurrentDate(current => addDays(current, direction === 'next' ? 7 : -7));
    };

    const handleAddShiftClick = (day: Date) => {
        setSelectedDateForShift(day);
        setIsAddShiftDialogOpen(true);
    };
    
    const handleSaveShift = async (templateId: string) => {
        if (!selectedDateForShift || !schedule) return;

        const template = shiftTemplates.find(t => t.id === templateId);
        if (!template) {
            toast({ title: 'Lỗi', description: 'Không tìm thấy ca làm việc mẫu.', variant: 'destructive'});
            return;
        }

        const newShift: AssignedShift = {
            id: `shift_${Date.now()}`,
            templateId: template.id,
            date: format(selectedDateForShift, 'yyyy-MM-dd'),
            label: template.label,
            role: template.role,
            timeSlot: template.timeSlot,
            assignedUsers: [],
        };
        
        const updatedShifts = [...schedule.shifts, newShift].sort((a, b) => a.timeSlot.start.localeCompare(b.timeSlot.start));
        await dataStore.updateSchedule(weekId, { shifts: updatedShifts });
        toast({ title: 'Thành công', description: `Đã thêm ca "${template.label}" vào lịch.`});
        setIsAddShiftDialogOpen(false);
    };

    const handleUpdateShiftAssignment = async (shiftId: string, newAssignedUsers: {userId: string, userName: string}[]) => {
        if (!schedule) return;
        const updatedShifts = schedule.shifts.map(shift => 
            shift.id === shiftId ? { ...shift, assignedUsers: newAssignedUsers } : shift
        );
        await dataStore.updateSchedule(weekId, { shifts: updatedShifts });
    }

    const handleDeleteShift = async (shiftId: string) => {
         if (!schedule) return;
        const updatedShifts = schedule.shifts.filter(shift => shift.id !== shiftId);
        await dataStore.updateSchedule(weekId, { shifts: updatedShifts });
        toast({ title: 'Đã xóa', description: 'Đã xóa ca làm việc khỏi lịch.'});
    }

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

     const shiftsByDay = useMemo(() => {
        const grouped: { [key: string]: AssignedShift[] } = {};
        if (schedule) {
            for (const shift of schedule.shifts) {
                if (!grouped[shift.date]) {
                    grouped[shift.date] = [];
                }
                grouped[shift.date].push(shift);
            }
        }
        return grouped;
    }, [schedule]);
    
    const availabilityByDay = useMemo(() => {
        const grouped: { [key: string]: Availability[] } = {};
         if (schedule && schedule.availability) {
            for (const avail of schedule.availability) {
                if (!grouped[avail.date]) {
                    grouped[avail.date] = [];
                }
                grouped[avail.date].push(avail);
            }
        }
        return grouped;
    }, [schedule]);


    if (isLoading || authLoading) {
        return (
            <div className="container mx-auto max-w-7xl p-4 sm:p-6 md:p-8">
                <Skeleton className="h-12 w-1/2 mb-4" />
                <Skeleton className="h-[60vh] w-full" />
            </div>
        )
    }

    return (
        <TooltipProvider>
        <div className="container mx-auto max-w-7xl p-4 sm:p-6 md:p-8">
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
                                <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Hôm nay</Button>
                                <Button variant="outline" size="icon" onClick={() => handleDateChange('next')}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                           {/* Desktop Timeline View */}
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[150px]">Nhân viên</TableHead>
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
                                        {allUsers.filter(u => u.role !== 'Chủ nhà hàng').map(user => (
                                            <TableRow key={user.uid}>
                                                <TableCell className="font-semibold">
                                                    <p>{user.displayName}</p>
                                                    <p className="text-xs text-muted-foreground font-normal">{user.role}</p>
                                                </TableCell>
                                                {daysOfWeek.map(day => {
                                                    const dateKey = format(day, 'yyyy-MM-dd');
                                                    const userAvailability = availabilityByDay[dateKey]?.find(a => a.userId === user.uid);
                                                    const assignedShift = shiftsByDay[dateKey]?.find(s => s.assignedUsers.some(au => au.userId === user.uid));
                                                    
                                                    return (
                                                        <TableCell key={dateKey} className="p-2 align-top text-center h-24">
                                                            {assignedShift ? (
                                                                <ShiftAssignmentPopover
                                                                    key={assignedShift.id}
                                                                    shift={assignedShift}
                                                                    availableUsers={allUsers.filter(u => u.role === assignedShift.role || assignedShift.role === 'Bất kỳ')}
                                                                    dailyAvailability={availabilityByDay[dateKey] || []}
                                                                    onUpdateAssignment={handleUpdateShiftAssignment}
                                                                    onDelete={handleDeleteShift}
                                                                    canEdit={schedule?.status === 'draft' || user?.role === 'Chủ nhà hàng'}
                                                                />
                                                            ) : userAvailability ? (
                                                                <div className="flex flex-col items-center justify-center h-full">
                                                                     <div className="text-xs text-green-600 space-y-0.5">
                                                                        {userAvailability.availableSlots.map((slot, i) => <div key={i}>{slot.start}-{slot.end}</div>)}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                               <div className="h-full w-full"></div>
                                                            )}
                                                        </TableCell>
                                                    )
                                                })}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            
                            {/* Mobile Agenda View */}
                            <div className="md:hidden space-y-4">
                                {daysOfWeek.map(day => {
                                    const dateKey = format(day, 'yyyy-MM-dd');
                                    const dayShifts = shiftsByDay[dateKey] || [];
                                    const dayAvailabilities = availabilityByDay[dateKey] || [];

                                    return (
                                        <Card key={dateKey} className={cn(isSameDay(day, new Date()) && "border-primary")}>
                                            <CardHeader className="p-3">
                                                <CardTitle className="text-base flex justify-between items-center">
                                                    <span>{format(day, 'cccc, dd/MM', { locale: vi })}</span>
                                                    <div className="flex -space-x-2">
                                                        {dayAvailabilities.map(avail => {
                                                            const user = allUsers.find(u => u.uid === avail.userId);
                                                            return user ? (
                                                                <Tooltip key={avail.userId}>
                                                                    <TooltipTrigger>
                                                                         <Avatar className="h-6 w-6 border-2 border-background">
                                                                            <AvatarFallback className="text-xs">{user.displayName.charAt(0)}</AvatarFallback>
                                                                        </Avatar>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>{user.displayName} rảnh:</p>
                                                                        <ul className="text-xs list-disc pl-4">
                                                                            {avail.availableSlots.map((s, i) => <li key={i}>{s.start} - {s.end}</li>)}
                                                                        </ul>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            ) : null
                                                        })}
                                                    </div>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-3 pt-0 space-y-2">
                                                {dayShifts.length > 0 ? dayShifts.map(shift => (
                                                    <ShiftAssignmentPopover
                                                        key={shift.id}
                                                        shift={shift}
                                                        availableUsers={allUsers.filter(u => u.role === shift.role || shift.role === 'Bất kỳ')}
                                                        dailyAvailability={availabilityByDay[dateKey] || []}
                                                        onUpdateAssignment={handleUpdateShiftAssignment}
                                                        onDelete={handleDeleteShift}
                                                        canEdit={schedule?.status === 'draft' || user?.role === 'Chủ nhà hàng'}
                                                    />
                                                )) : <p className="text-xs text-muted-foreground text-center py-2">Chưa có ca làm việc</p>}
                                                
                                                {(schedule?.status === 'draft' || user?.role === 'Chủ nhà hàng') && (
                                                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => handleAddShiftClick(day)}>
                                                        <Plus className="mr-2 h-4 w-4"/> Thêm ca
                                                    </Button>
                                                )}
                                            </CardContent>
                                        </Card>
                                    )
                                })}
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
             <AddShiftDialog
                isOpen={isAddShiftDialogOpen}
                onClose={() => setIsAddShiftDialogOpen(false)}
                onSave={handleSaveShift}
                templates={shiftTemplates}
                date={selectedDateForShift}
            />
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
