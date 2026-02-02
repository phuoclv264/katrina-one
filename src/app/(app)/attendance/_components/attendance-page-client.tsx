'use client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'nextjs-toploader/app';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ArrowLeft, UserCheck, RefreshCw, Loader2, DollarSign, LayoutGrid, GanttChartSquare, X, Calendar as CalendarIcon, Calculator, UserX } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import type { AttendanceRecord, ManagedUser, Schedule, ShiftTemplate, UserRole, SpecialPeriod } from '@/lib/types';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isSameMonth, startOfToday, endOfToday, getISOWeek, getISOWeekYear, getYear, getDay, parse, differenceInMinutes } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import { findNearestAttendanceRecord } from '@/lib/attendance-utils';
import AttendanceTable from './attendance-table';
import AttendanceCards from './attendance-cards';
import EditAttendanceDialog from './edit-attendance-dialog';
import ManualAttendanceDialog from './manual-attendance-dialog';
import BulkSalaryDialog from './bulk-salary-dialog';
import { toast } from '@/components/ui/pro-toast';
import Lightbox from "yet-another-react-lightbox";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { cn, generateShortName } from '@/lib/utils';
import SalaryManagementDialog from './salary-management-dialog';
import AttendanceTimeline from './attendance-timeline';
import SpecialPeriodsDialog from './special-periods-dialog';
import { Combobox } from '@/components/combobox';
import { Timestamp } from 'firebase/firestore';
import AbsencePenaltyDialog from './absence-penalty-dialog';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { useLightbox } from '@/contexts/lightbox-context';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { LoadingPage } from '@/components/loading/LoadingPage';

export default function AttendancePageComponent() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const isMobile = useIsMobile();
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [specialPeriods, setSpecialPeriods] = useState<SpecialPeriod[]>([]);
    const [schedules, setSchedules] = useState<Record<string, Schedule>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [recordToEdit, setRecordToEdit] = useState<AttendanceRecord | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isBulkSalaryDialogOpen, setIsBulkSalaryDialogOpen] = useState(false);
    const [isSalaryManagementDialogOpen, setIsSalaryManagementDialogOpen] = useState(false);
    const [isManualAttendanceDialogOpen, setIsManualAttendanceDialogOpen] = useState(false);
    const [isSpecialPeriodsDialogOpen, setIsSpecialPeriodsDialogOpen] = useState(false);
    const [isAbsencePenaltyDialogOpen, setIsAbsencePenaltyDialogOpen] = useState(false);
    const [isSavingSalaries, setIsSavingSalaries] = useState(false);

    const handleCreateSpecialPeriod = useCallback(
        async (payload: Omit<SpecialPeriod, 'id' | 'createdAt' | 'updatedAt'>) => {
            await dataStore.createSpecialPeriod(payload);
        },
        []
    );

    const handleDeleteSpecialPeriod = useCallback(async (id: string) => {
        await dataStore.deleteSpecialPeriod(id);
    }, []);

    // New state for filters and view
    const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
    const [selectedUsers, setSelectedUsers] = useState<ManagedUser[]>([]);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfMonth(currentMonth), to: endOfMonth(currentMonth) });

    const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
    const [tempDateRange, setTempDateRange] = useState<DateRange | undefined>(dateRange);

    const { openLightbox } = useLightbox();

    useEffect(() => {
        if (!authLoading && user?.role !== 'Chủ nhà hàng') {
            router.replace('/');
        }
    }, [user, authLoading, router]);

    const handleReconnect = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    // This useEffect will now handle all data subscriptions based on the dateRange.
    useEffect(() => {
        if (!user || !dateRange?.from || !dateRange?.to) return;
        setIsLoading(true);

        const unsubUsers = dataStore.subscribeToUsers(setAllUsers);

        const unsubSchedules = dataStore.subscribeToSchedulesForDateRange(dateRange, (schedules) => {
            const scheduleMap = schedules.reduce((acc, s) => {
                acc[s.weekId] = s;
                return acc;
            }, {} as Record<string, Schedule>);
            setSchedules(scheduleMap);
        });

        const unsubRecords = dataStore.subscribeToAttendanceRecordsForDateRange(dateRange, setAttendanceRecords);
        const unsubSpecialPeriods = dataStore.subscribeToSpecialPeriods(setSpecialPeriods);

        return () => {
            unsubUsers();
            unsubRecords();
            unsubSchedules();
            unsubSpecialPeriods();
        };
    }, [user, dateRange, refreshTrigger]);

    useDataRefresher(handleReconnect);

    useEffect(() => {
        if (isLoading && (schedules || attendanceRecords.length > 0 || allUsers.length > 0)) {
            setIsLoading(false);
        }
    }, [schedules, attendanceRecords, allUsers]);

    useEffect(() => {
        setDateRange({ from: startOfMonth(currentMonth), to: endOfMonth(currentMonth) });
        setSelectedUsers([]); // Reset employee filter on month change
    }, [currentMonth]);

    useEffect(() => {
        if (isDatePopoverOpen) {
            setTempDateRange(dateRange);
        }
    }, [isDatePopoverOpen, dateRange]);

    const handleDateRangeSave = () => {
        setDateRange(tempDateRange);
        setIsDatePopoverOpen(false);
    };

    const selectedUserIds = useMemo(() => new Set(selectedUsers.map(u => u.uid)), [selectedUsers]);

    const filteredRecords = useMemo(() => {
        return attendanceRecords.filter(record => {
            const recordDate = (record.checkInTime as Timestamp).toDate();
            const isEmployeeMatch = selectedUserIds.size === 0 || selectedUserIds.has(record.userId);
            const isDateMatch = dateRange?.from && dateRange?.to && recordDate >= dateRange.from && recordDate <= dateRange.to;
            return isEmployeeMatch && isDateMatch;
        });
    }, [attendanceRecords, selectedUserIds, dateRange]);

    const totalSalary = useMemo(() => {
        return filteredRecords.reduce((total, record) => total + (record.salary || 0), 0);
    }, [filteredRecords]);

    // Pagination / incremental loading for performance: show first N records and load more when user
    // scrolls to bottom. This slices the records passed into child list components.
    const PAGE_SIZE = 50;
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const sentinelRef = useRef<HTMLDivElement | null>(null);
    const isFetchingRef = useRef(false);

    // Reset visible count when filters or underlying records change
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [filteredRecords]);

    const visibleRecords = useMemo(() => filteredRecords.slice(0, visibleCount), [filteredRecords, visibleCount]);

    useEffect(() => {
        const el = sentinelRef.current;
        if (!el) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && filteredRecords.length > visibleCount && !isFetchingRef.current) {
                    // simple debounce/lock to avoid rapid multiple increments
                    isFetchingRef.current = true;
                    // small timeout to allow UI to update smoothly
                    setTimeout(() => {
                        setVisibleCount(prev => Math.min(prev + PAGE_SIZE, filteredRecords.length));
                        isFetchingRef.current = false;
                    }, 150);
                }
            });
        }, { root: null, rootMargin: '200px', threshold: 0.1 });

        observer.observe(el);
        return () => observer.disconnect();
    }, [filteredRecords.length, visibleCount]);

    const todaysSummary = useMemo(() => {
        const today = new Date();
        const todayStart = startOfToday();
        const todayEnd = endOfToday();
        const todayDateString = format(today, 'yyyy-MM-dd');
        const weekId = `${getISOWeekYear(today)}-W${getISOWeek(today)}`;
        const todaysSchedule = schedules[weekId];

        const todaysRecords = attendanceRecords.filter(record => {
            if (!record.checkInTime) return false;
            const checkInDate = (record.checkInTime as Timestamp).toDate();
            return checkInDate >= todayStart && checkInDate <= todayEnd;
        });

        // Step 1: Group all of today's records by user ID for easy lookup.
        const userRecords = new Map<string, AttendanceRecord[]>();
        todaysRecords.forEach(record => {
            if (!userRecords.has(record.userId)) {
                userRecords.set(record.userId, []);
            }
            userRecords.get(record.userId)!.push(record);
        });

        // Step 2: Build the shift structure for today from the schedule.
        const shiftsForToday = todaysSchedule?.shifts.filter(s => s.date === todayDateString) || [];
        const shiftGroups = new Map<string, { shiftLabel: string; timeSlot: string; staff: any[] }>();
        const processedRecordIds = new Set<string>();

        shiftsForToday.forEach(shift => {
            const key = `${shift.label} (${shift.timeSlot.start}-${shift.timeSlot.end})`;
            if (!shiftGroups.has(key)) {
                shiftGroups.set(key, { shiftLabel: shift.label, timeSlot: `${shift.timeSlot.start}-${shift.timeSlot.end}`, staff: [] });
            }
            const group = shiftGroups.get(key)!;
            const shiftDate = new Date(shift.date);
            const shiftStartTime = parse(shift.timeSlot.start, 'HH:mm', shiftDate);
            const shiftEndTime = parse(shift.timeSlot.end, 'HH:mm', shiftDate);

            shift.assignedUsers.forEach(assignedUser => {
                const user = allUsers.find(u => u.uid === assignedUser.userId);
                if (user) {
                    const recordsForUser = userRecords.get(user.uid) || [];

                    // Use the utility function to find the nearest record
                    const bestMatch = findNearestAttendanceRecord(recordsForUser, shiftStartTime);

                    const attendanceData = bestMatch ? {
                        id: bestMatch.id,
                        status: bestMatch.status,
                        checkInTime: (bestMatch.checkInTime as Timestamp)?.toDate(),
                        checkOutTime: (bestMatch.checkOutTime as Timestamp)?.toDate(),
                        salary: bestMatch.salary,
                    } : {
                        id: `scheduled-${shift.id}-${user.uid}`
                    };

                    group.staff.push({ user, ...attendanceData });

                    if (bestMatch) processedRecordIds.add(bestMatch.id);
                }
            });
        });

        // Step 3: Group any remaining, completely unmatched records into "Ngoài giờ".
        const offShiftRecords = todaysRecords.filter(r => !processedRecordIds.has(r.id));
        if (offShiftRecords.length > 0) {
            const offShiftKey = 'Ngoài giờ';
            if (!shiftGroups.has(offShiftKey)) {
                shiftGroups.set(offShiftKey, { shiftLabel: 'Ngoài giờ', timeSlot: '', staff: [] });
            }
            const offShiftGroup = shiftGroups.get(offShiftKey)!;
            offShiftRecords.forEach(record => {
                const user = allUsers.find(u => u.uid === record.userId);
                if (user) {
                    offShiftGroup.staff.push({
                        user,
                        id: record.id,
                        status: record.status,
                        checkInTime: (record.checkInTime as Timestamp)?.toDate(),
                        checkOutTime: (record.checkOutTime as Timestamp)?.toDate(),
                        salary: record.salary
                    });
                }
            });
        }

        const totalSalaryToday = todaysRecords.reduce((sum, record) => sum + (record.salary || 0), 0);

        return { staffByShift: Array.from(shiftGroups.values()), totalSalaryToday };
    }, [attendanceRecords, allUsers, schedules]);

    const handleMonthChange = (direction: 'prev' | 'next') => {
        setCurrentMonth(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
    };

    const handleUserSelectionChange = (users: ManagedUser[]) => {
        setSelectedUsers(users);
    };

    const handleEditRecord = (record: AttendanceRecord) => {
        setRecordToEdit(record);
        setIsEditDialogOpen(true);
    };

    const handleSaveRecord = async (id: string, data: { checkInTime: Date, checkOutTime?: Date, hourlyRate?: number }) => {
        const toastId = toast.loading("Đang cập nhật...");
        try {
            await dataStore.updateAttendanceRecordDetails(id, data);
            toast.success("Đã cập nhật bản ghi chấm công.", { id: toastId });
        } catch (error) {
            toast.error("Lỗi khi cập nhật.", { id: toastId });
        }
    };

    const handleSaveManualAttendance = async (data: { userId: string; checkInTime: Date; checkOutTime: Date; }) => {
        if (!user) return;
        const toastId = toast.loading("Đang tạo bản ghi...");
        try {
            await dataStore.createManualAttendanceRecord(data, user);
            toast.success("Đã tạo bản ghi chấm công thủ công.", { id: toastId });
        } catch (error) {
            console.error("Failed to save manual attendance:", error);
            toast.error("Lỗi khi tạo bản ghi.", { id: toastId });
        }
    };

    const handleDeleteRecord = async (id: string) => {
        const toastId = toast.loading("Đang xóa...");
        try {
            await dataStore.deleteAttendanceRecord(id);
            toast.success("Đã xóa bản ghi chấm công.", { id: toastId });
        } catch (error) {
            toast.error("Lỗi khi xóa.", { id: toastId });
        }
    };

    const handleSaveBulkRates = async (rates: { [userId: string]: number }) => {
        setIsSavingSalaries(true);
        const toastId = toast.loading("Đang cập nhật lương...");
        try {
            await dataStore.bulkUpdateUserRates(rates);
            toast.success("Đã cập nhật lương cho tất cả nhân viên.", { id: toastId });
        } catch (error) {
            toast.error("Lỗi khi cập nhật lương.", { id: toastId });
        } finally {
            setIsSavingSalaries(false);
        }
    };

    const sortedUsers = useMemo(() => [...allUsers].sort((a, b) => a.displayName.localeCompare(b.displayName)), [allUsers]);

    const roleOrder: Record<UserRole, number> = {
        'Chủ nhà hàng': 1,
        'Quản lý': 2,
        'Thu ngân': 3,
        'Pha chế': 4,
        'Phục vụ': 5,
    };

    // if (isLoading || authLoading) {
    //     return <LoadingPage />;
    // }

    return (
        <>
            <div className="container mx-auto p-4 sm:p-6 md:p-8">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><UserCheck /> Quản lý Chấm công</h1>
                        <p className="text-muted-foreground mt-2">Xem lại lịch sử chấm công và chi phí lương của nhân viên.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <Button variant="outline" onClick={() => setIsSpecialPeriodsDialogOpen(true)}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            Giai đoạn đặc biệt
                        </Button>
                        <Button variant="outline" onClick={() => setIsAbsencePenaltyDialogOpen(true)}>
                            <UserX className="mr-2 h-4 w-4" />
                            Phạt vắng mặt
                        </Button>
                        <Button variant="outline" onClick={() => setIsBulkSalaryDialogOpen(true)}>
                            <DollarSign className="mr-2 h-4 w-4" />
                            Quản lý Lương
                        </Button>
                        <Button variant="default" onClick={() => setIsSalaryManagementDialogOpen(true)}>
                            <Calculator className="mr-2 h-4 w-4" />
                            Bảng lương tháng
                        </Button>
                        <AlertDialog parentDialogTag="root">
                            <Button variant="secondary" onClick={() => setIsManualAttendanceDialogOpen(true)}>
                                <UserCheck className="mr-2 h-4 w-4" />
                                Chấm công thủ công
                            </Button>
                        </AlertDialog>
                    </div>
                </div>

                <Card className="my-6">
                    <CardHeader>
                        <CardTitle>Bộ lọc và Tổng quan</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Employee Filter */}
                            <Combobox
                                options={allUsers
                                    .filter(u => u.role !== 'Chủ nhà hàng')
                                    .map(u => ({ value: u.uid, label: u.displayName }))}
                                multiple
                                value={selectedUsers.map(u => u.uid)}
                                onChange={(next) => {
                                    const nextIds = Array.isArray(next)
                                        ? next
                                        : typeof next === 'string' && next
                                            ? [next]
                                            : [];
                                    handleUserSelectionChange(
                                        nextIds
                                            .map(id => allUsers.find(u => u.uid === id))
                                            .filter((u): u is ManagedUser => !!u)
                                    );
                                }}
                                placeholder="Chọn nhân viên..."
                                searchPlaceholder="Tìm nhân viên..."
                                emptyText="Không tìm thấy nhân viên."
                                className="w-full"
                            />

                            {/* Date Range Filter */}
                            <Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {dateRange?.from ? (
                                            dateRange.to ? (
                                                <>
                                                    {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                                                </>
                                            ) : (
                                                format(dateRange.from, "dd/MM/yy")
                                            )
                                        ) : (
                                            <span>Chọn ngày</span>
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        initialFocus
                                        mode="range"
                                        defaultMonth={tempDateRange?.from}
                                        selected={tempDateRange}
                                        onSelect={setTempDateRange}
                                        numberOfMonths={1}
                                    />
                                    <div className="p-2 border-t flex justify-end">
                                        <Button onClick={handleDateRangeSave}>Lưu</Button>
                                    </div>
                                </PopoverContent>
                            </Popover>

                            {/* Clear Filters */}
                            {(selectedUsers.length > 0 || dateRange) && (
                                <Button variant="ghost" onClick={() => { setSelectedUsers([]); setDateRange({ from: startOfMonth(currentMonth), to: endOfMonth(currentMonth) }); setViewMode('table'); }}>
                                    <X className="mr-2 h-4 w-4" /> Xóa bộ lọc
                                </Button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-4 border-t">
                            <Card className="lg:col-span-1">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg">Tổng quan giai đoạn</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground">Tổng lương</p>
                                    <p className="text-2xl font-bold text-primary">{totalSalary.toLocaleString('vi-VN')}đ</p>
                                </CardContent>
                            </Card>
                            <Card className="lg:col-span-2">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg">Tổng quan hôm nay ({format(new Date(), 'dd/MM')})</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-sm text-muted-foreground">Tổng lương hôm nay</p>
                                            <p className="text-2xl font-bold text-primary">{todaysSummary.totalSalaryToday.toLocaleString('vi-VN')}đ</p>
                                        </div>
                                        {!isMobile &&
                                            (<div className="flex items-center gap-2">
                                                <Button variant="outline" onClick={() => setViewMode(prev => prev === 'table' ? 'timeline' : 'table')}>
                                                    {viewMode === 'table' ? (
                                                        <><GanttChartSquare className="mr-2 h-4 w-4" /> Timeline View</>
                                                    ) : (
                                                        <><LayoutGrid className="mr-2 h-4 w-4" /> Xem Bảng</>
                                                    )}
                                                </Button>
                                            </div>)}
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        {todaysSummary.staffByShift.sort((a, b) => a.timeSlot.localeCompare(b.timeSlot)).map(({ shiftLabel, timeSlot, staff }) => (
                                            <div key={`${shiftLabel}-${timeSlot}`} className="p-2 rounded-md border bg-muted/30">
                                                <p className="font-semibold text-sm">{shiftLabel} <span className="text-xs text-muted-foreground font-normal">{timeSlot}</span></p>
                                                <div className="mt-1 space-y-1 pl-2">
                                                    {staff.sort((a, b) => (roleOrder[a.user.role as UserRole] || 99) - (roleOrder[b.user.role as UserRole] || 99)).map(({ user, id, salary, status, checkInTime, checkOutTime }) => (
                                                        <div key={id} className="flex justify-between items-center text-sm gap-2">
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                                <span className={cn("h-2 w-2 rounded-full", status === 'in-progress' ? 'bg-green-500 animate-pulse' : (status ? 'bg-gray-400' : 'bg-red-500'))} title={status ? (status === 'in-progress' ? 'Đang làm việc' : 'Đã làm') : 'Vắng mặt'}></span>
                                                                <p className="truncate">{isMobile ? generateShortName(user.displayName) : user.displayName} <span className="text-xs text-muted-foreground">({user.role})</span></p>
                                                            </div>
                                                            {checkInTime && <p className="text-xs font-mono text-muted-foreground shrink-0">{format(checkInTime, 'HH:mm')} - {checkOutTime ? format(checkOutTime, 'HH:mm') : '...'}</p>}
                                                            {!checkInTime && <p className="text-xs font-mono text-red-500">{differenceInMinutes(new Date(), parse(timeSlot.split('-')[0], 'HH:mm', new Date())) < 0 ? 'Waiting' : 'Vắng'} </p>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </CardContent>
                </Card>

                {viewMode === 'timeline' && dateRange?.from && dateRange?.to ? (
                    <AttendanceTimeline
                        records={visibleRecords}
                        users={allUsers}
                        schedules={schedules}
                        dateRange={{ from: dateRange.from, to: dateRange.to }}
                        filteredUserIds={selectedUserIds}
                        onOpenLightbox={openLightbox}
                    />
                ) : isMobile ? (
                    <AttendanceCards
                        records={visibleRecords}
                        users={allUsers}
                        schedules={schedules}
                        onEdit={handleEditRecord}
                        onDelete={handleDeleteRecord}
                        onOpenLightbox={openLightbox}
                    />
                ) : (
                    <AttendanceTable
                        records={visibleRecords}
                        users={allUsers}
                        schedules={schedules}
                        onEdit={handleEditRecord}
                        onDelete={handleDeleteRecord}
                        onOpenLightbox={openLightbox}
                    />
                )}

                {/* Sentinel to trigger loading more records when scrolled into view */}
                {visibleCount < filteredRecords.length && (
                    <div ref={sentinelRef} className="text-center p-4 text-sm text-muted-foreground">Đang tải thêm...</div>
                )}
            </div>

            <EditAttendanceDialog
                isOpen={isEditDialogOpen}
                onClose={() => setIsEditDialogOpen(false)}
                record={recordToEdit}
                onSave={handleSaveRecord}
                parentDialogTag="root"
            />

            <BulkSalaryDialog
                isOpen={isBulkSalaryDialogOpen}
                onClose={() => setIsBulkSalaryDialogOpen(false)}
                users={allUsers}
                onSave={handleSaveBulkRates}
                isSaving={isSavingSalaries}
                parentDialogTag="root"
            />

            <ManualAttendanceDialog
                isOpen={isManualAttendanceDialogOpen}
                onClose={() => setIsManualAttendanceDialogOpen(false)}
                users={sortedUsers}
                onSave={handleSaveManualAttendance}
                parentDialogTag="root"
            />

            <SalaryManagementDialog
                isOpen={isSalaryManagementDialogOpen}
                onClose={() => setIsSalaryManagementDialogOpen(false)}
                allUsers={allUsers}
                parentDialogTag='root'
            />

            <SpecialPeriodsDialog
                isOpen={isSpecialPeriodsDialogOpen}
                onClose={() => setIsSpecialPeriodsDialogOpen(false)}
                specialPeriods={specialPeriods}
                users={allUsers}
                onCreateSpecialPeriod={handleCreateSpecialPeriod}
                onDeleteSpecialPeriod={handleDeleteSpecialPeriod}
                parentDialogTag="root"
            />

            <AbsencePenaltyDialog
                isOpen={isAbsencePenaltyDialogOpen}
                onClose={() => setIsAbsencePenaltyDialogOpen(false)}
                schedules={schedules}
                attendanceRecords={attendanceRecords}
                users={allUsers}
                currentUser={user}
                parentDialogTag="root"
            />
        </>
    )
}