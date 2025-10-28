'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ChevronLeft, ChevronRight, UserCheck, RefreshCw, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { dataStore } from '@/lib/data-store';
import type { AttendanceRecord, ManagedUser, Schedule } from '@/lib/types';
import { format, addMonths, subMonths } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useIsMobile } from '@/hooks/use-mobile';
import AttendanceTable from './_components/attendance-table';
import AttendanceCards from './_components/attendance-cards';
import { toast } from 'react-hot-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


export default function AttendancePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const isMobile = useIsMobile();

    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [schedules, setSchedules] = useState<Record<string, Schedule>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isResolving, setIsResolving] = useState(false);

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
    }, [user, currentMonth]);

    const totalSalary = useMemo(() => {
        return attendanceRecords.reduce((total, record) => total + (record.salary || 0), 0);
    }, [attendanceRecords]);
    
    const handleMonthChange = (direction: 'prev' | 'next') => {
        setCurrentMonth(prev => direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1));
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


    if (isLoading || authLoading) {
        return (
            <div className="container mx-auto p-4 sm:p-6 md:p-8">
                <header className="mb-8"><Skeleton className="h-10 w-1/2" /></header>
                <Card><CardContent><Skeleton className="h-96 w-full" /></CardContent></Card>
            </div>
        );
    }
    
    return (
        <div className="container mx-auto p-4 sm:p-6 md:p-8">
            <header className="mb-8">
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
                     <div className="flex flex-col sm:flex-row items-center gap-2">
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
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleMonthChange('prev')}><ChevronLeft className="h-4 w-4" /></Button>
                            <span className="text-lg font-medium w-32 text-center">{format(currentMonth, 'MM/yyyy')}</span>
                            <Button variant="outline" size="icon" onClick={() => handleMonthChange('next')}><ChevronRight className="h-4 w-4" /></Button>
                        </div>
                    </div>
                </div>
            </header>
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Tổng chi phí lương tháng {format(currentMonth, 'MM/yyyy')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-3xl font-bold text-primary">{totalSalary.toLocaleString('vi-VN')}đ</p>
                </CardContent>
            </Card>

            {isMobile ? (
                <AttendanceCards 
                    records={attendanceRecords} 
                    users={allUsers} 
                    schedules={schedules} 
                />
            ) : (
                <AttendanceTable 
                    records={attendanceRecords} 
                    users={allUsers} 
                    schedules={schedules} 
                />
            )}
        </div>
    )
}
