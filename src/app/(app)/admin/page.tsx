'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Banknote, CalendarCheck, Loader2 } from 'lucide-react';
import { dataStore } from '@/lib/data-store';
import type { RevenueStats, AttendanceRecord, Schedule, ShiftReport, WhistleblowingReport, ManagedUser, ExpenseSlip } from '@/lib/types';
import { format, startOfToday, endOfToday, getISOWeek, getYear, isAfter, startOfDay, parse, differenceInMinutes } from 'date-fns';
import { AttendanceOverviewCard } from './_components/AttendanceOverviewCard';
import { RecentReportsCard } from './_components/RecentReportsCard';
import { RecentComplaintsCard } from './_components/RecentComplaintsCard';
import { CashierOverviewCard, CashierOverviewCardProps } from './_components/CashierOverviewCard';
import { SchedulingOverviewCard } from './_components/SchedulingOverviewCard';

export default function AdminDashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [revenueStats, setRevenueStats] = useState<RevenueStats[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [shiftReports, setShiftReports] = useState<ShiftReport[]>([]);
    const [complaints, setComplaints] = useState<WhistleblowingReport[]>([]);
    const [dailySlips, setDailySlips] = useState<ExpenseSlip[]>([]);
    const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [todaysSchedule, setTodaysSchedule] = useState<Schedule | null>(null);

    useEffect(() => {
        if (!authLoading && user?.role !== 'Chủ nhà hàng') {
            router.replace('/');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user) return;
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const weekId = `${getYear(new Date())}-W${getISOWeek(new Date())}`;

        const unsubs = [
            dataStore.subscribeToDailyRevenueStats(todayStr, setRevenueStats),
            dataStore.subscribeToAttendanceRecordsForDateRange({ from: startOfToday(), to: endOfToday() }, setAttendanceRecords),
            dataStore.subscribeToSchedule(weekId, setTodaysSchedule),
            dataStore.subscribeToReportsForDay(todayStr, setShiftReports),
            dataStore.subscribeToReportFeed(setComplaints),
            dataStore.subscribeToDailyExpenseSlips(todayStr, setDailySlips),
            dataStore.subscribeToUsers(setAllUsers),
        ];

        const timer = setTimeout(() => setIsLoading(false), 1200);

        return () => {
            unsubs.forEach(unsub => unsub());
            clearTimeout(timer);
        };
    }, [user]);

    const cashierOverview = useMemo(() => {
        // Use the most recent revenue report as the source of truth for the day's total revenue.
        const latestStat = revenueStats.length > 0 ? revenueStats[0] : null;

        const revenueByMethod = latestStat?.revenueByPaymentMethod || {};

        const expenseByMethod = dailySlips.reduce((acc, slip) => {
            const method = slip.paymentMethod;
            const amount = slip.actualPaidAmount ?? slip.totalAmount;
            if (!acc[method]) {
                acc[method] = 0;
            }
            acc[method] += amount;
            return acc;
        }, {} as Record<string, number>);

        const totalCashExpense = expenseByMethod['cash'] || 0;

        return {
            profit: (latestStat?.netRevenue ?? 0) - totalCashExpense,
            totalRevenue: latestStat?.netRevenue ?? 0,
            totalExpense: totalCashExpense,
            revenueByMethod,
            expenseByMethod,
        };
    }, [revenueStats, dailySlips]);

    const attendanceOverview = useMemo(() => {
        const now = new Date();
        const checkedInUserIds = new Set(attendanceRecords.map(r => r.userId));

        // Count unique users who are late. A user is late if they checked in > 5 mins after shift start,
        // or if they have a pending late request.
        const lateUserIds = new Set<string>();
        attendanceRecords.forEach(record => {
            if (record.status === 'pending_late') {
                lateUserIds.add(record.userId);
            }
            if (record.checkInTime && todaysSchedule) {
                const checkInTime = (record.checkInTime as any).toDate();
                const shiftsForUser = todaysSchedule.shifts.filter(s => s.assignedUsers.some(u => u.userId === record.userId));
                
                shiftsForUser.forEach(shift => {
                    const shiftStartTime = parse(shift.timeSlot.start, 'HH:mm', new Date(shift.date));
                    if (differenceInMinutes(checkInTime, shiftStartTime) > 5) {
                        lateUserIds.add(record.userId);
                    }
                });
            }
        });

        // Determine absent users more accurately
        const absentUserIds = new Set<string>();
        if (todaysSchedule) {
            const shiftsStarted = todaysSchedule.shifts.filter(shift => {
                const shiftStartTime = parse(shift.timeSlot.start, 'HH:mm', new Date(shift.date));
                return now > shiftStartTime;
            });

            shiftsStarted.forEach(shift => {
                shift.assignedUsers.forEach(user => {
                    if (!checkedInUserIds.has(user.userId)) {
                        absentUserIds.add(user.userId);
                    }
                });
            });
        }
        return {
            checkedIn: checkedInUserIds.size,
            absent: absentUserIds.size,
            late: lateUserIds.size,
        };
    }, [attendanceRecords, todaysSchedule]);

    const upcomingShifts = useMemo(() => {
        if (!todaysSchedule) return [];
        const now = new Date();
        return todaysSchedule.shifts
            .filter(shift => isAfter(startOfDay(new Date(shift.date)), startOfDay(now)) || format(new Date(shift.date), 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd'))
            .slice(0, 5);
    }, [todaysSchedule]);

    if (authLoading || isLoading) {
        return (
            <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Đang tải dữ liệu...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-headline">Tổng quan cho Chủ Nhà Hàng</h1>
                <p className="text-muted-foreground mt-1">Xem nhanh các thông tin quản lý trong ngày.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <CashierOverviewCard {...cashierOverview as CashierOverviewCardProps} />
                <AttendanceOverviewCard {...attendanceOverview} />
                <SchedulingOverviewCard upcomingShiftsCount={upcomingShifts.length} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <RecentReportsCard shiftReports={shiftReports} />
                <RecentComplaintsCard complaints={complaints} allUsers={allUsers} />
            </div>
        </div>
    );
}