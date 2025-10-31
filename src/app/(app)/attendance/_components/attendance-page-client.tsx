'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton'; 
import { ArrowLeft, UserCheck, RefreshCw, Loader2, DollarSign, LayoutGrid, GanttChartSquare, X, Calendar as CalendarIcon } from 'lucide-react';
import Link from 'next/link';
import { dataStore } from '@/lib/data-store';
import type { AttendanceRecord, ManagedUser, Schedule } from '@/lib/types';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import AttendanceTable from './attendance-table';
import AttendanceCards from './attendance-cards';
import EditAttendanceDialog from './edit-attendance-dialog';
import ManualAttendanceDialog from './manual-attendance-dialog';
import BulkSalaryDialog from './bulk-salary-dialog';
import { toast } from 'react-hot-toast';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DateRange } from 'react-day-picker';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import AttendanceTimeline from './attendance-timeline';
import { UserMultiSelect } from '@/components/user-multi-select';
import { Timestamp } from 'firebase/firestore';

export default function AttendancePageComponent() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const isMobile = useIsMobile();

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [schedules, setSchedules] = useState<Record<string, Schedule>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isResolving, setIsResolving] = useState(false);
    const [recordToEdit, setRecordToEdit] = useState<AttendanceRecord | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isBulkSalaryDialogOpen, setIsBulkSalaryDialogOpen] = useState(false);
    const [isManualAttendanceDialogOpen, setIsManualAttendanceDialogOpen] = useState(false);
    const [isSavingSalaries, setIsSavingSalaries] = useState(false);

    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [lightboxSlides, setLightboxSlides] = useState<{ src: string }[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    // New state for filters and view
    const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');
    const [selectedUsers, setSelectedUsers] = useState<ManagedUser[]>([]);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: startOfMonth(currentMonth), to: endOfMonth(currentMonth) });


    useEffect(() => {
        if (!authLoading && user?.role !== 'Chủ nhà hàng') {
            router.replace('/');
        }
    }, [user, authLoading, router]);
    
    useEffect(() => {
        if (!user) return;
        setIsLoading(true);

        const unsubUsers = dataStore.subscribeToUsers(setAllUsers);
        
        const unsubSchedules = dataStore.subscribeToSchedulesForMonth(currentMonth, (schedules) => {
            const scheduleMap = schedules.reduce((acc, s) => {
                acc[s.weekId] = s;
                return acc;
            }, {} as Record<string, Schedule>);
            setSchedules(scheduleMap);
        });

        // The logic is now inside subscribeToAllAttendanceRecordsForMonth
        const unsubRecords = dataStore.subscribeToAllAttendanceRecordsForMonth(currentMonth, setAttendanceRecords);

        const timer = setTimeout(() => setIsLoading(false), 1500);

        return () => {
            unsubUsers();
            unsubRecords();
            unsubSchedules();
            clearTimeout(timer);
        };
    }, [user, currentMonth]); // Keep this dependency array to refetch on month change

    useEffect(() => {
        setDateRange({ from: startOfMonth(currentMonth), to: endOfMonth(currentMonth) });
        setSelectedUsers([]); // Reset employee filter on month change
    }, [currentMonth]);

    // Back button handling for Lightbox
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (isLightboxOpen) {
                event.preventDefault();
                setIsLightboxOpen(false);
            }
        };

        if (isLightboxOpen) {
            window.history.pushState({ lightbox: 'open' }, '');
            window.addEventListener('popstate', handlePopState);
        } else {
            if (window.history.state?.lightbox) {
                window.history.back();
            }
        }

        return () => window.removeEventListener('popstate', handlePopState);
    }, [isLightboxOpen]);

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
    
    const handleMonthChange = (direction: 'prev' | 'next') => {
        setCurrentMonth(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
    };

    const handleUserSelectionChange = (users: ManagedUser[]) => {
        setSelectedUsers(users);
        if (users.length > 0 || (dateRange && !isSameMonth(dateRange.from!, dateRange.to!))) {
            setViewMode('timeline');
        }
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

    const handleResolveUnfinished = async () => {
        setIsResolving(true);
        const toastId = toast.loading("Đang tìm và chốt sổ các ca chưa hoàn tất...");
        try {
            const count = await dataStore.resolveUnfinishedAttendances();
            if (count > 0) {
                toast.success(`Đã tự động chốt sổ thành công cho ${count} ca làm việc.`, { id: toastId });
            } else {
                toast.success('Không có ca làm nào cần chốt sổ.', { id: toastId });
            }
        } catch (error) {
            console.error("Failed to resolve unfinished attendances:", error);
            toast.error('Có lỗi xảy ra khi chốt sổ.', { id: toastId });
        } finally {
            setIsResolving(false);
        }
    };

    const handleOpenLightbox = useCallback((slides: { src: string }[], index: number) => {
        setLightboxSlides(slides);
        setLightboxIndex(index);
        setIsLightboxOpen(true);
    }, []);

    const sortedUsers = useMemo(() => [...allUsers].sort((a, b) => a.displayName.localeCompare(b.displayName)), [allUsers]);

    if (isLoading || authLoading) {
        return (
            <div className="container mx-auto p-4 sm:p-6 md:p-8">
                <header className="mb-8"><Skeleton className="h-10 w-1/2" /></header>
                <Card><CardContent><Skeleton className="h-96 w-full" /></CardContent></Card>
            </div>
        );
    }
    
    return (
        <>
            <div className="container mx-auto p-4 sm:p-6 md:p-8">
                 <Button asChild variant="ghost" className="-ml-4 mb-4">
                    <Link href="/reports">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Quay lại
                    </Link>
                </Button>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><UserCheck /> Quản lý Chấm công</h1>
                        <p className="text-muted-foreground mt-2">Xem lại lịch sử chấm công và chi phí lương của nhân viên.</p>
                    </div>
                     <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                         <Button variant="outline" onClick={() => setIsBulkSalaryDialogOpen(true)}>
                            <DollarSign className="mr-2 h-4 w-4" />
                            Quản lý Lương
                         </Button>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" disabled={isResolving}>
                                    {isResolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                    Chốt sổ ca làm
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Xác nhận chốt sổ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Hành động này sẽ tìm tất cả các ca làm việc chưa được chấm công ra từ ngày hôm qua trở về trước và tự động kết thúc chúng. Bạn có muốn tiếp tục không?
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction onClick={handleResolveUnfinished}>Xác nhận</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
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
                            <UserMultiSelect
                                users={allUsers}
                                selectedUsers={selectedUsers}
                                onChange={handleUserSelectionChange}
                                className="w-full"
                            />

                            {/* Date Range Filter */}
                            <Popover>
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
                                        defaultMonth={dateRange?.from}
                                        selected={dateRange}
                                        onSelect={setDateRange}
                                        numberOfMonths={2}
                                    />
                                </PopoverContent>
                            </Popover>

                            {/* Clear Filters */}
                            {(selectedUsers.length > 0 || dateRange) && (
                                <Button variant="ghost" onClick={() => { setSelectedUsers([]); setDateRange({ from: startOfMonth(currentMonth), to: endOfMonth(currentMonth) }); setViewMode('table'); }}>
                                    <X className="mr-2 h-4 w-4" /> Xóa bộ lọc
                                </Button>
                            )}
                        </div>

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pt-4 border-t">
                            <div>
                                <p className="text-sm text-muted-foreground">Tổng lương cho giai đoạn đã chọn</p>
                                <p className="text-2xl font-bold text-primary">{totalSalary.toLocaleString('vi-VN')}đ</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" onClick={() => setViewMode(prev => prev === 'table' ? 'timeline' : 'table')}>
                                    {viewMode === 'table' ? (
                                        <><GanttChartSquare className="mr-2 h-4 w-4" /> Xem Dòng thời gian</>
                                    ) : (
                                        <><LayoutGrid className="mr-2 h-4 w-4" /> Xem Bảng</>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {viewMode === 'timeline' && dateRange?.from && dateRange?.to ? (
                    <AttendanceTimeline
                        records={filteredRecords}
                        users={allUsers}
                        schedules={schedules}
                        dateRange={{ from: dateRange.from, to: dateRange.to }}
                        filteredUserIds={selectedUserIds}
                    />
                ) : isMobile ? (
                    <AttendanceCards 
                        records={filteredRecords} 
                        users={allUsers} 
                        schedules={schedules} 
                        onEdit={handleEditRecord}
                        onDelete={handleDeleteRecord}
                        onOpenLightbox={handleOpenLightbox}
                    />
                ) : (
                    <AttendanceTable 
                        records={filteredRecords} 
                        users={allUsers} 
                        schedules={schedules} 
                        onEdit={handleEditRecord}
                        onDelete={handleDeleteRecord}
                        onOpenLightbox={handleOpenLightbox}
                    />
                )}
            </div>

            <EditAttendanceDialog
                isOpen={isEditDialogOpen}
                onClose={() => setIsEditDialogOpen(false)}
                record={recordToEdit}
                onSave={handleSaveRecord}
            />

            <BulkSalaryDialog
                isOpen={isBulkSalaryDialogOpen}
                onClose={() => setIsBulkSalaryDialogOpen(false)}
                users={allUsers}
                onSave={handleSaveBulkRates}
                isSaving={isSavingSalaries}
            />
            
            <ManualAttendanceDialog
                isOpen={isManualAttendanceDialogOpen}
                onClose={() => setIsManualAttendanceDialogOpen(false)}
                users={sortedUsers}
                onSave={handleSaveManualAttendance}
            />

            <Lightbox
                open={isLightboxOpen}
                close={() => setIsLightboxOpen(false)}
                slides={lightboxSlides}
                index={lightboxIndex}
                plugins={[Zoom]}
            />
        </>
    )
}