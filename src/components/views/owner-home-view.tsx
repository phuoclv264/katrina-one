'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { useRouter } from 'nextjs-toploader/app';
import { dataStore } from '@/lib/data-store';
import type {
  RevenueStats,
  AttendanceRecord,
  Schedule,
  ShiftReport,
  WhistleblowingReport,
  ManagedUser,
  ExpenseSlip,
  MonthlyTaskAssignment,
  MonthlyTask,
} from '@/lib/types';
import {
  format,
  startOfToday,
  endOfToday,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  getISOWeek,
  getISOWeekYear,
  isWithinInterval,
  addDays,
  parse,
  differenceInMinutes,
} from 'date-fns';
import { DashboardHeader } from '@/app/(app)/admin/_components/DashboardHeader';
import { KPIMetricsSection } from '@/app/(app)/admin/_components/KPIMetricsSection';
import { RevenueAnalyticsSection } from '@/app/(app)/admin/_components/RevenueAnalyticsSection';
import { RecentReportsCard } from '@/app/(app)/admin/_components/RecentReportsCard';
import { QuickAccessToolsSection } from '@/app/(app)/admin/_components/QuickAccessToolsSection';
import MonthlyStaffReportDialog from '@/app/(app)/reports/_components/MonthlyStaffReportDialog';
import SalaryManagementDialog from '@/app/(app)/attendance/_components/salary-management-dialog';
import { RecurringTasksCard } from '@/app/(app)/admin/_components/RecurringTasksCard';
import { TodaysScheduleSection } from '@/app/(app)/admin/_components/TodaysScheduleSection';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { findNearestAttendanceRecord } from '@/lib/attendance-utils';
import { toDateSafe, cn } from '@/lib/utils';

interface OwnerHomeViewProps {
    isStandalone?: boolean;
}

export function OwnerHomeView({ isStandalone = false }: OwnerHomeViewProps) {
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
  const [isMonthlyReportOpen, setIsMonthlyReportOpen] = useState(false);
  const [isSalaryDialogOpen, setIsSalaryDialogOpen] = useState(false);
  const [todaysSchedule, setTodaysSchedule] = useState<Schedule | null>(null);

  useEffect(() => {
    if (!authLoading && user?.role !== 'Chủ nhà hàng') {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  const handleReconnect = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | 'week'>('today');
  const [trendData, setTrendData] = useState<{ revenue: number; expense: number; profit: number; label: string }>({ revenue: 0, expense: 0, profit: 0, label: 'So với hôm qua' });

  useEffect(() => {
    if (!user) return;
    const today = new Date();
    const weekId = `${getISOWeekYear(new Date())}-W${getISOWeek(new Date())}`;

    // Choose subscriptions depending on dateFilter. 'today' and 'yesterday' use single-day subscriptions
    // while 'week' uses range queries where available.
    if (dateFilter === 'week') {
      // Ensure the week range covers the full days (00:00 - 23:59)
      const start = startOfDay(startOfWeek(today, { weekStartsOn: 1 }));
      const end = endOfDay(endOfWeek(today, { weekStartsOn: 1 }));
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');

      const unsubs = [
        // Subscribe to revenue stats across the week
        dataStore.subscribeToRevenueStatsForDateRange(startStr, endStr, setRevenueStats),
        dataStore.subscribeToAttendanceRecordsForDateRange({ from: start, to: end }, setAttendanceRecords),
        dataStore.subscribeToSchedule(weekId, setTodaysSchedule),
        dataStore.subscribeToReportFeed(setComplaints),
        dataStore.subscribeToUsers(setAllUsers),
        dataStore.subscribeToMonthlyTasks(setMonthlyTasks),
        dataStore.subscribeToMonthlyTasksForDate(new Date(startStr), setTaskAssignments),
      ];

      // For reports and expense slips we currently have range getters; fetch them once for the week
      dataStore.getShiftReportsForDateRange({ from: start, to: end }).then(setShiftReports).catch(() => setShiftReports([]));
      // Expense slips range getter lives in cashierStore via dataStore
      dataStore.getExpenseSlipsForDateRange?.({ from: startStr, to: endStr }).then(setDailySlips).catch(() => setDailySlips([]));

      return () => unsubs.forEach((u) => u());
    }

    // Determine the target day (yesterday when requested) so we subscribe to the correct week if needed
    const targetDate = dateFilter === 'yesterday' ? addDays(today, -1) : today;
    const todayStr = format(targetDate, 'yyyy-MM-dd');
    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);

    // Use the week that contains the target date so Monday->yesterday (Sunday) finds the previous week's schedule
    const targetWeekId = `${getISOWeekYear(targetDate)}-W${getISOWeek(targetDate)}`;

    const unsubs = [
      dataStore.subscribeToDailyRevenueStats(todayStr, setRevenueStats),
      dataStore.subscribeToAttendanceRecordsForDateRange({ from: dayStart, to: dayEnd }, setAttendanceRecords),
      dataStore.subscribeToSchedule(targetWeekId, setTodaysSchedule),
      dataStore.subscribeToReportsForDay(todayStr, setShiftReports),
      dataStore.subscribeToReportFeed(setComplaints),
      dataStore.subscribeToDailyExpenseSlips(todayStr, setDailySlips),
      dataStore.subscribeToUsers(setAllUsers),
      dataStore.subscribeToMonthlyTasks(setMonthlyTasks),
      dataStore.subscribeToMonthlyTasksForDate(new Date(todayStr), setTaskAssignments),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [user, refreshTrigger, dateFilter]);

  useEffect(() => {
    if (
      isLoading &&
      (revenueStats.length > 0 ||
        attendanceRecords.length > 0 ||
        todaysSchedule ||
        shiftReports.length > 0 ||
        complaints.length > 0 ||
        dailySlips.length > 0 ||
        allUsers.length > 0 ||
        monthlyTasks.length > 0 ||
        taskAssignments.length > 0)
    ) {
      setIsLoading(false);
    }
  }, [revenueStats, attendanceRecords, todaysSchedule, shiftReports, complaints, dailySlips, allUsers, monthlyTasks, taskAssignments]);

  useDataRefresher(handleReconnect);

  const cashierOverview = useMemo(() => {
    // Aggregate across the revenueStats array so weekly ranges work as well as single-day
    const revenueByMethod = revenueStats.reduce((acc, stat) => {
      const rb = stat.revenueByPaymentMethod || {};
      Object.entries(rb).forEach(([k, v]) => {
        acc[k] = (acc[k] || 0) + (v || 0);
      });
      return acc;
    }, {} as Record<string, number>);

    const expenseByMethod = dailySlips.reduce(
      (acc, slip) => {
        const method = slip.paymentMethod;
        const amount = slip.actualPaidAmount ?? slip.totalAmount;
        if (!acc[method]) {
          acc[method] = 0;
        }
        acc[method] += amount;
        return acc;
      },
      {} as Record<string, number>
    );

    const totalRevenue = revenueStats.reduce((sum, s) => sum + (s.netRevenue || 0), 0);
    const totalExpense = Object.values(expenseByMethod).reduce((sum, amount) => sum + amount, 0);
    const profit = totalRevenue - totalExpense;

    return {
      profit,
      totalRevenue,
      totalExpense,
      revenueByMethod: revenueByMethod as RevenueStats['revenueByPaymentMethod'],
      expenseByMethod,
    };
  }, [revenueStats, dailySlips]);

  useEffect(() => {
    // Recalculate trend (compare to previous period) whenever date filter or current totals change
    const computeTrend = async () => {
      try {
        const today = new Date();
        let currStart: Date, currEnd: Date, prevStart: Date, prevEnd: Date, label = 'So với hôm qua';

        if (dateFilter === 'week') {
          currStart = startOfDay(startOfWeek(today, { weekStartsOn: 1 }));
          currEnd = endOfDay(endOfWeek(today, { weekStartsOn: 1 }));
          const prevWeekBase = addDays(today, -7);
          prevStart = startOfDay(startOfWeek(prevWeekBase, { weekStartsOn: 1 }));
          prevEnd = endOfDay(endOfWeek(prevWeekBase, { weekStartsOn: 1 }));
          label = 'So với tuần trước';
        } else {
          const selected = dateFilter === 'yesterday' ? addDays(today, -1) : today;
          currStart = startOfDay(selected);
          currEnd = endOfDay(selected);
          prevStart = addDays(currStart, -1);
          prevEnd = addDays(currEnd, -1);
          label = 'So với hôm qua';
        }

        // Current totals from cashierOverview
        const currRevenue = cashierOverview.totalRevenue;
        const currExpense = cashierOverview.totalExpense;
        const currProfit = currRevenue - currExpense;

        // Fetch previous period data. For single-day comparisons use the daily getters (which return newest stat for that date)
        let prevRevenue = 0;
        let prevExpense = 0;
        if (dateFilter === 'week') {
          const prevRevenueStats: any[] = await (dataStore as any).getRevenueStatsForDateRange?.({ from: format(prevStart, 'yyyy-MM-dd'), to: format(prevEnd, 'yyyy-MM-dd') }) || [];
          prevRevenue = prevRevenueStats.reduce((s: number, st: any) => s + (st.netRevenue || 0), 0);

          const prevExpenseSlips: any[] = await (dataStore as any).getExpenseSlipsForDateRange?.({ from: format(prevStart, 'yyyy-MM-dd'), to: format(prevEnd, 'yyyy-MM-dd') }) || [];
          prevExpense = prevExpenseSlips.reduce((s: number, slip: any) => s + (slip.actualPaidAmount ?? slip.totalAmount ?? 0), 0);
        } else {
          const prevDateStr = format(prevStart, 'yyyy-MM-dd');
          const prevDailyRevenue: any[] = await (dataStore as any).getDailyRevenueStats?.(prevDateStr) || [];
          prevRevenue = prevDailyRevenue[0]?.netRevenue || 0;

          const prevDailyExpense: any[] = await (dataStore as any).getDailyExpenseSlips?.(prevDateStr) || [];
          prevExpense = prevDailyExpense.reduce((s: number, slip: any) => s + (slip.actualPaidAmount ?? slip.totalAmount ?? 0), 0);
        }

        const prevProfit = prevRevenue - prevExpense;

        const pct = (curr: number, prev: number) => {
          if (!prev) return curr ? 100 : 0;
          return Math.round(((curr - prev) / Math.abs(prev)) * 100);
        };

        setTrendData({ revenue: pct(currRevenue, prevRevenue), expense: pct(currExpense, prevExpense), profit: pct(currProfit, prevProfit), label });
      } catch (err) {
        // fail silently and leave trends as-is
        console.error('Failed to compute trend data:', err);
      }
    };
    computeTrend();
  }, [dateFilter, cashierOverview.totalRevenue, cashierOverview.totalExpense]);

  const attendanceOverview = useMemo(() => {
    // Use the selected date filter when deriving the day to display.
    const now = dateFilter === 'yesterday' ? addDays(new Date(), -1) : new Date();
    const todayStr = format(now, 'yyyy-MM-dd');

    const recordsByUser = attendanceRecords.reduce(
      (acc, record) => {
        if (!acc[record.userId]) {
          acc[record.userId] = [];
        }
        acc[record.userId].push(record);
        return acc;
      },
      {} as Record<string, AttendanceRecord[]>
    );

    const todayShifts =
      todaysSchedule?.shifts
        .filter((shift) => shift.date === todayStr)
        .map((shift) => {
          const shiftStart = parse(shift.timeSlot.start, 'HH:mm', new Date(shift.date));
          const shiftEnd = parse(shift.timeSlot.end, 'HH:mm', new Date(shift.date));
          const isActive = isWithinInterval(now, { start: shiftStart, end: shiftEnd });

          const employees = shift.assignedUsers.map((assignedUser) => {
            const userRecords = recordsByUser[assignedUser.userId] || [];
            const nearestRecord = findNearestAttendanceRecord(userRecords, shiftStart);

            let status: 'present' | 'late' | 'absent' | 'pending_late' = 'absent';
            let checkInTime: Date | null = null;
            let checkOutTime: Date | null = null;
            let lateMinutes: number | null = null;
            let lateReason: string | null = null;
            let estimatedLateMinutes: number | null = null;

            if (nearestRecord) {
              if (nearestRecord.status === 'pending_late') {
                status = 'pending_late';
                estimatedLateMinutes = typeof nearestRecord.estimatedLateMinutes === 'number' ? nearestRecord.estimatedLateMinutes : null;
                lateReason = nearestRecord.lateReason || (estimatedLateMinutes ? `Dự kiến trễ ${estimatedLateMinutes} phút` : null);
              } else if (nearestRecord.checkInTime) {
                checkInTime = toDateSafe(nearestRecord.checkInTime);
                checkOutTime = toDateSafe(nearestRecord.checkOutTime);

                if (nearestRecord.lateReason) {
                  lateReason = nearestRecord.lateReason;
                }

                if (nearestRecord.estimatedLateMinutes && nearestRecord.estimatedLateMinutes > 0) {
                  estimatedLateMinutes = nearestRecord.estimatedLateMinutes;
                }

                const shiftStartTime = parse(shift.timeSlot.start, 'HH:mm', new Date(shift.date));

                if (shiftStartTime.getHours() < 6) {
                  shiftStartTime.setHours(6, 0, 0, 0);
                }

                if (checkInTime) {
                  // adjust shift start for managers: if the shift start is 06:00 and the assigned user is a manager ("Quản lý"),
                  // treat the shift as starting at 07:00 to avoid marking them late for an early manager shift.
                  const staff = allUsers.find(
                    (u: any) =>
                      u.id === assignedUser.userId ||
                      u.uid === assignedUser.userId ||
                      u.userId === assignedUser.userId
                  );
                  if (staff?.role === 'Quản lý' && shiftStartTime.getHours() === 6) {
                    shiftStartTime.setHours(7, 0, 0, 0);
                  }

                  const diff = differenceInMinutes(checkInTime, shiftStartTime);
                  if (diff > 5) {
                    status = 'late';
                    lateMinutes = diff;
                  } else {
                    status = 'present';
                  }
                } else {
                  status = 'absent';
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
              checkOutTime,
              lateMinutes,
              lateReason,
              estimatedLateMinutes,
            };
          });
          return { ...shift, employees, isActive };
        }) || [];

    return {
      todayShifts,
    };
  }, [attendanceRecords, todaysSchedule, allUsers, dateFilter]);

  const kpiMetrics = useMemo(() => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const todayShifts = todaysSchedule?.shifts.filter((s) => s.date === todayStr) || [];

    const presentCount = attendanceOverview.todayShifts.reduce((count, shift) => {
      const presentEmployees = shift.employees.filter((e) => e.status === 'present' || e.status === 'late').length;
      return count + presentEmployees;
    }, 0);

    const lateCount = attendanceOverview.todayShifts.reduce((count, shift) => {
      const lateEmployees = shift.employees.filter((e) => e.status === 'late').length;
      return count + lateEmployees;
    }, 0);

    return [
      {
        label: 'Tổng doanh thu',
        value: `${cashierOverview.totalRevenue.toLocaleString('vi-VN')}đ`,
        icon: '💰',
        color: 'green' as const,
        bgColor: 'bg-white dark:bg-gray-800',
        iconBgColor: 'bg-green-50 dark:bg-green-900/20',
        iconColor: 'text-green-600 dark:text-green-400',
        trend: trendData.revenue,
        trendLabel: trendData.label,
      },
      {
        label: 'Tổng chi phí',
        value: `${cashierOverview.totalExpense.toLocaleString('vi-VN')}đ`,
        icon: '💳',
        color: 'orange' as const,
        bgColor: 'bg-white dark:bg-gray-800',
        iconBgColor: 'bg-orange-50 dark:bg-orange-900/20',
        iconColor: 'text-orange-600 dark:text-orange-400',
        trend: trendData.expense,
        trendLabel: trendData.label,
      },
      {
        label: 'Lợi nhuận ròng',
        value: `${cashierOverview.profit.toLocaleString('vi-VN')}đ`,
        icon: '📈',
        color: 'blue' as const,
        bgColor: 'bg-white dark:bg-gray-800',
        iconBgColor: 'bg-blue-50 dark:bg-blue-900/20',
        iconColor: 'text-blue-600 dark:text-blue-400',
        trend: trendData.profit,
        trendLabel: trendData.label,
      },
      {
        label: 'Nhân sự hôm nay',
        value: `${presentCount}`,
        icon: '👥',
        color: 'purple' as const,
        bgColor: 'bg-white dark:bg-gray-800',
        iconBgColor: 'bg-purple-50 dark:bg-purple-900/20',
        iconColor: 'text-purple-600 dark:text-purple-400',
        trendLabel: `${lateCount > 0 ? `${lateCount} đi trễ` : 'Đầy đủ'}`,
      },
    ];
  }, [cashierOverview, attendanceOverview, todaysSchedule, trendData]);

  const todayShifts = useMemo(() => {
    const now = dateFilter === 'yesterday' ? addDays(new Date(), -1) : new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    return (
      attendanceOverview.todayShifts
        .filter((s) => s.date === todayStr)
        .map((shift) => ({
          ...shift,
          isActive: isWithinInterval(now, {
            start: parse(shift.timeSlot.start, 'HH:mm', new Date(todayStr)),
            end: parse(shift.timeSlot.end, 'HH:mm', new Date(todayStr)),
          }),
        })) || []
    );
  }, [attendanceOverview, dateFilter]);

  if (authLoading || isLoading) {
    return <LoadingPage />;
  }

  return (
    <div className={cn("min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col", !isStandalone && "min-h-0 bg-transparent")}>
      {/* Header */}
      <DashboardHeader
        userName={user?.displayName || 'Admin User'}
        userRole={user?.role || 'Chủ cửa hàng'}
        complaintsCount={
          // Compute number of report-feed items in the selected filter range
          (() => {
            try {
              if (dateFilter === 'week') {
                const start = startOfWeek(new Date(), { weekStartsOn: 1 });
                const end = endOfWeek(new Date(), { weekStartsOn: 1 });
                return complaints.filter((r) => {
                  const created = (r.createdAt && (r.createdAt as any)?.toDate) ? (r.createdAt as any).toDate() : new Date(String(r.createdAt || ''));
                  return created >= start && created <= end;
                }).length;
              }
              const day = dateFilter === 'yesterday' ? format(addDays(new Date(), -1), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
              return complaints.filter((r) => {
                const created = (r.createdAt && (r.createdAt as any)?.toDate) ? (r.createdAt as any).toDate() : new Date(String(r.createdAt || ''));
                return format(created, 'yyyy-MM-dd') === day;
              }).length;
            } catch (e) {
              return complaints.length;
            }
          })()
        }
        selectedDateFilter={dateFilter}
        onDateFilterChange={(f) => setDateFilter(f)}
      />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scroll-smooth">
        {/* KPI Metrics */}
        <KPIMetricsSection metrics={kpiMetrics} />

        {/* Main content grid: Analytics + Cards */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-8">
          {/* Left: Revenue Analytics (2 cols) */}
          <div className="xl:col-span-2">
            <RevenueAnalyticsSection
              revenueByMethod={cashierOverview.revenueByMethod}
              totalRevenue={cashierOverview.totalRevenue}
            />
            {/* Schedule */}
            <TodaysScheduleSection shifts={todayShifts} />
          </div>

          {/* Right column: Quick access + Tasks (1 col) */}
          <div className="space-y-6">
            <QuickAccessToolsSection onNavigate={(path) => {
              if (path === 'create-monthly-report') {
                setIsMonthlyReportOpen(true);
              } else if (path === 'salary-management') {
                setIsSalaryDialogOpen(true);
              } else {
                router.push(path);
              }
            }} />
            <MonthlyStaffReportDialog isOpen={isMonthlyReportOpen} onOpenChange={(open: boolean) => setIsMonthlyReportOpen(open)} />
            <SalaryManagementDialog isOpen={isSalaryDialogOpen} onClose={() => setIsSalaryDialogOpen(false)} allUsers={allUsers} />
            <RecurringTasksCard monthlyTasks={monthlyTasks} taskAssignments={taskAssignments} staffDirectory={allUsers} />
          </div>
        </div>

        {/* Reports */}
        <div className="mb-8">
          <RecentReportsCard shiftReports={shiftReports} />
        </div>
      </main>
    </div>
  );
}
