'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { useRouter } from 'nextjs-toploader/app';
import { dataStore } from '@/lib/data-store';
import type { RevenueStats, AttendanceRecord, Schedule, ShiftReport, WhistleblowingReport, ManagedUser, ExpenseSlip, MonthlyTaskAssignment, MonthlyTask } from '@/lib/types';
import { format, startOfToday, endOfToday, getISOWeek, getYear, isAfter, startOfDay, parse, differenceInMinutes, isWithinInterval, addDays } from 'date-fns';
import { ActiveShiftWithAttendance, AttendanceOverviewCard, AttendanceOverviewCardProps } from './_components/AttendanceOverviewCard';
import { RecentReportsCard } from './_components/RecentReportsCard';
import { RecentComplaintsCard } from './_components/RecentComplaintsCard';
import { CashierOverviewCard, CashierOverviewCardProps } from './_components/CashierOverviewCard';
import { ManagementLinksCard } from './_components/ManagementLinksCard';
import { SchedulingOverviewCard } from './_components/SchedulingOverviewCard';
import { LoadingPage } from '@/components/loading/LoadingPage';
import TodaysAdminTasksCard from './_components/TodaysAdminTasksCard';

export default function AdminDashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [revenueStats, setRevenueStats] = useState<RevenueStats[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [shiftReports, setShiftReports] = useState<ShiftReport[]>([]);
    const [complaints, setComplaints] = useState<WhistleblowingReport[]>([]);
    const [dailySlips, setDailySlips] = useState<ExpenseSlip[]>([]);
    const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
    const [monthlyTasks, setMonthlyTasks] = useState<MonthlyTask[]>([]);
    const [taskAssignments, setTaskAssignments] = useState<MonthlyTaskAssignment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [todaysSchedule, setTodaysSchedule] = useState<Schedule | null>(null);

    useEffect(() => {
        if (!authLoading && user?.role !== 'Chủ nhà hàng') {
            router.replace('/');
        }
    }, [user, authLoading, router]);

    const handleReconnect = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

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
            dataStore.subscribeToMonthlyTasks(setMonthlyTasks),
            dataStore.subscribeToMonthlyTasksForDate(new Date(todayStr), setTaskAssignments),
        ];

        return () => {
            unsubs.forEach(unsub => unsub());
        };
    }, [user, refreshTrigger]);

    useEffect(() => {
        if (isLoading && (revenueStats.length > 0 || attendanceRecords.length > 0 || todaysSchedule || shiftReports.length > 0 || complaints.length > 0 || dailySlips.length > 0 || allUsers.length > 0 || monthlyTasks.length > 0 || taskAssignments.length > 0)) {
            setIsLoading(false);
        }
    }, [revenueStats, attendanceRecords, todaysSchedule, shiftReports, complaints, dailySlips, allUsers, monthlyTasks, taskAssignments]);

    useDataRefresher(handleReconnect);

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

        const totalExpense = Object.values(expenseByMethod).reduce((sum, amount) => sum + amount, 0);
        const profit = (latestStat?.netRevenue ?? 0) - totalExpense;

        return {
            profit: profit,
            totalRevenue: latestStat?.netRevenue ?? 0,
            totalExpense: totalExpense,
            revenueByMethod,
            expenseByMethod,
        };
    }, [revenueStats, dailySlips]);

    const attendanceOverview = useMemo(() => {
        const now = new Date();

        // Sort checkedInRecords from newest to oldest
        const sortedAttendanceRecords = [...attendanceRecords].sort((a, b) => {
            const timeA = (a.checkInTime as any)?.toMillis?.() || 0;
            const timeB = (b.checkInTime as any)?.toMillis?.() || 0;
            return timeB - timeA;
        });

        const checkedInRecords = new Map(sortedAttendanceRecords.map(r => [r.userId, r]));
        
        const activeShifts = todaysSchedule?.shifts.filter(shift => {
            const shiftStart = parse(shift.timeSlot.start, 'HH:mm', new Date(shift.date));
            const shiftEnd = parse(shift.timeSlot.end, 'HH:mm', new Date(shift.date));
            return isWithinInterval(now, { start: shiftStart, end: shiftEnd });
        }).map(shift => {
            const employees = shift.assignedUsers.map(assignedUser => {
                const record = checkedInRecords.get(assignedUser.userId);
                let status: 'present' | 'late' | 'absent' | 'pending_late' = 'absent';
                let checkInTime: Date | null = null;
                let lateMinutes: number | null = null;
                let lateReason: string | null = null;

                if (record) {
                    if (record.status === 'pending_late') {
                        status = 'pending_late';
                        lateReason = record.lateReason || `Dự kiến trễ ${record.estimatedLateMinutes} phút`;
                    } else if (record.checkInTime) {
                        checkInTime = (record.checkInTime as any).toDate();
                        const shiftStartTime = parse(shift.timeSlot.start, 'HH:mm', new Date(shift.date));
                        
                        if (shiftStartTime.getHours() < 6) {
                            shiftStartTime.setHours(6, 0, 0, 0);
                        }

                        const diff = differenceInMinutes(checkInTime as Date, shiftStartTime);
                        if (diff > 5) {
                            status = 'late';
                            lateMinutes = diff;
                        } else {
                            status = 'present';
                        }
                    } else {
                        status = 'absent';
                    }
                }
                return {
                    id: assignedUser.userId,
                    name: assignedUser.userName,
                    status,
                    checkInTime,
                    lateMinutes,
                    lateReason,
                };
            });
            return { ...shift, employees};
        }) || [];

        return {
            activeShifts: activeShifts,
        };
    }, [attendanceRecords, todaysSchedule, allUsers]);

    const upcomingShifts = useMemo(() => {
        if (!todaysSchedule) return [];
        const now = new Date();
        const todayStr = format(now, 'yyyy-MM-dd');
        const tomorrowStr = format(addDays(now, 1), 'yyyy-MM-dd');

        const remainingTodayShifts = todaysSchedule.shifts.filter(shift => {
            if (shift.date !== todayStr) return false;
            const shiftEnd = parse(shift.timeSlot.end, 'HH:mm', new Date(shift.date));
            return isAfter(shiftEnd, now);
        });

        const tomorrowShifts = todaysSchedule.shifts.filter(shift => shift.date === tomorrowStr);

        return [...remainingTodayShifts, ...tomorrowShifts];
    }, [todaysSchedule]);

    if (authLoading || isLoading) {
        return <LoadingPage />;
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-headline">Tổng quan cho Chủ Nhà Hàng</h1>
                <p className="text-muted-foreground mt-1">Xem nhanh các thông tin quản lý trong ngày.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <CashierOverviewCard {...cashierOverview as CashierOverviewCardProps} />
                <AttendanceOverviewCard activeShifts={attendanceOverview.activeShifts} />
                <SchedulingOverviewCard upcomingShifts={upcomingShifts} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                <RecentReportsCard shiftReports={shiftReports} />
                <RecentComplaintsCard complaints={complaints} allUsers={allUsers} />
                <TodaysAdminTasksCard monthlyTasks={monthlyTasks} taskAssignments={taskAssignments} staffDirectory={allUsers} />
                <ManagementLinksCard />
            </div>
        </div>
    );
}