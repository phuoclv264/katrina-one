'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { dataStore } from '@/lib/data-store';
import type {
  RevenueStats,
  AttendanceRecord,
  AssignedShift,
  Schedule,
  ShiftReport,
  WhistleblowingReport,
  ManagedUser,
  ExpenseSlip,
  MonthlyTaskAssignment,
  MonthlyTask,
  IncidentReport,
  InventoryItem, CashHandoverReport,
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
  isBefore,
  isAfter,
  addDays,
  parse,
  differenceInMinutes,
  isSameDay,
} from 'date-fns';
import { DashboardHeader } from '@/app/(app)/admin/_components/DashboardHeader';
import { subscribeToHandoverReport } from '@/lib/cashier-store';
import { KPIMetricsSection } from '@/app/(app)/admin/_components/KPIMetricsSection';
import { RevenueAnalyticsSection } from '@/app/(app)/admin/_components/RevenueAnalyticsSection';
import { RecentReportsCard } from '@/app/(app)/admin/_components/RecentReportsCard';
import { QuickAccessToolsSection } from '@/app/(app)/admin/_components/QuickAccessToolsSection';
import MonthlyStaffReportDialog from '@/app/(app)/reports/_components/MonthlyStaffReportDialog';
import SalaryManagementDialog from '@/app/(app)/attendance/_components/salary-management-dialog';
import { RecurringTasksCard } from '@/app/(app)/admin/_components/RecurringTasksCard';
import { TodaysScheduleSection } from '@/app/(app)/admin/_components/TodaysScheduleSection';
import { CashierDataDialog } from '@/app/(app)/admin/_components/CashierDataDialog';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { findNearestAttendanceRecord } from '@/lib/attendance-utils';
import { toDateSafe, cn, selectLatestRevenueStats } from '@/lib/utils';
import { useAppNavigation } from '@/contexts/app-navigation-context';

interface OwnerHomeViewProps {
  isStandalone?: boolean;
}

export function OwnerHomeView({ isStandalone = false }: OwnerHomeViewProps) {
  const { user, loading: authLoading } = useAuth();
  const nav = useAppNavigation();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [revenueStats, setRevenueStats] = useState<RevenueStats[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [shiftReports, setShiftReports] = useState<ShiftReport[]>([]);
  const [complaints, setComplaints] = useState<WhistleblowingReport[]>([]);
  const [dailySlips, setDailySlips] = useState<ExpenseSlip[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [allUsers, setAllUsers] = useState<ManagedUser[]>([]);
  const [monthlyTasks, setMonthlyTasks] = useState<MonthlyTask[]>([]);
  const [taskAssignments, setTaskAssignments] = useState<MonthlyTaskAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMonthlyReportOpen, setIsMonthlyReportOpen] = useState(false);
  const [isSalaryDialogOpen, setIsSalaryDialogOpen] = useState(false);
  const [isCashierDataDialogOpen, setIsCashierDataDialogOpen] = useState(false);
  const [todaysSchedule, setTodaysSchedule] = useState<Schedule | null>(null);
  const [handoverByDate, setHandoverByDate] = useState<Record<string, CashHandoverReport[] | null>>({});

  useEffect(() => {
    if (!authLoading && user?.role !== 'Chủ nhà hàng') {
      nav.replace('/');
    }
  }, [user, authLoading, nav]);

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
        dataStore.subscribeToRevenueStatsForDateRange(startStr, endStr, setRevenueStats, true),
        dataStore.subscribeToAttendanceRecordsForDateRange({ from: start, to: end }, setAttendanceRecords, false),
        dataStore.subscribeToSchedule(weekId, setTodaysSchedule),
        dataStore.subscribeToReportFeed(setComplaints),
        dataStore.subscribeToUsers(setAllUsers),
        dataStore.subscribeToMonthlyTasks(setMonthlyTasks),
        dataStore.subscribeToMonthlyTasksForDateForOwner(new Date(startStr), setTaskAssignments, { allUsers, schedule: todaysSchedule }),
        dataStore.subscribeToAllIncidents(setIncidents),
        dataStore.subscribeToInventoryList(setInventoryList),
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
      dataStore.subscribeToDailyRevenueStats(todayStr, setRevenueStats, true),
      dataStore.subscribeToAttendanceRecordsForDateRange({ from: dayStart, to: dayEnd }, setAttendanceRecords, false),
      dataStore.subscribeToSchedule(targetWeekId, setTodaysSchedule),
      dataStore.subscribeToReportsForDay(todayStr, setShiftReports),
      dataStore.subscribeToReportFeed(setComplaints),
      dataStore.subscribeToDailyExpenseSlips(todayStr, setDailySlips),
      dataStore.subscribeToUsers(setAllUsers),
      dataStore.subscribeToMonthlyTasks(setMonthlyTasks),
      dataStore.subscribeToMonthlyTasksForDateForOwner(new Date(todayStr), setTaskAssignments, { allUsers, schedule: todaysSchedule }),
      dataStore.subscribeToAllIncidents(setIncidents),
      dataStore.subscribeToInventoryList(setInventoryList),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [user, refreshTrigger, dateFilter]);

  // Subscribe to cash handover reports for dates represented in the current revenueStats so the dialog
  // can display 'Tiền mặt thực tế' and discrepancy details without subscribing itself.
  useEffect(() => {
    const dates = Array.from(new Set(revenueStats.map((s) => s.date)));
    const unsubs = dates.map((d) => subscribeToHandoverReport(d, (reports) => {
      // normalize callback input to either an array or null
      let normalized: CashHandoverReport[] | null = null;
      if (reports) {
        normalized = Array.isArray(reports) ? reports : [reports];
      }
      setHandoverByDate((prev) => ({ ...prev, [d]: normalized }));
    }));
    return () => {
      unsubs.forEach((u) => u && typeof u === 'function' && u());
    };
  }, [revenueStats]);

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

  const effectiveRevenueStats = useMemo(() => {
    return selectLatestRevenueStats(revenueStats);
  }, [revenueStats]);

  const cashierOverview = useMemo(() => {
    // revenueStats may include multiple snapshots for a day.
    // - If a single day: use only the latest stat.
    // - If multiple days: use the latest stat per day.
    const revenueByMethod = effectiveRevenueStats.reduce((acc, stat) => {
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

    const totalRevenue = effectiveRevenueStats.reduce((sum, s) => sum + (s.netRevenue || 0), 0);
    const totalExpense = Object.values(expenseByMethod).reduce((sum, amount) => sum + amount, 0);
    const profit = totalRevenue - totalExpense;

    return {
      profit,
      totalRevenue,
      totalExpense,
      revenueByMethod: revenueByMethod as RevenueStats['revenueByPaymentMethod'],
      expenseByMethod,
    };
  }, [effectiveRevenueStats, dailySlips]);

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

    const currentDayShifts = todaysSchedule?.shifts.filter((s) => s.date === todayStr) || [];

    const userToShiftsMap = currentDayShifts.reduce((acc, s) => {
      s.assignedUsers.forEach(u => {
        if (!acc[u.userId]) acc[u.userId] = [];
        acc[u.userId].push(s);
      });
      return acc;
    }, {} as Record<string, AssignedShift[]>);

    // Track which record belongs to which shift
    const recordToShiftAssignment = new Map<string, string>(); // recordId -> shiftId
    const shiftUserToRecordAssignment = new Map<string, string>(); // "shiftId_userId" -> recordId

    // For each record, find the shift it's closest to
    attendanceRecords.forEach(record => {
      if (!record.checkInTime) return;
      const userShifts = userToShiftsMap[record.userId] || [];
      if (userShifts.length === 0) return;

      const recordTime = toDateSafe(record.checkInTime)!;
      let closestShiftId = '';
      let minDiff = Infinity;

      userShifts.forEach(s => {
        const sStart = parse(s.timeSlot.start, 'HH:mm', new Date(s.date));
        const diff = Math.abs(differenceInMinutes(recordTime, sStart));
        if (diff < minDiff) {
          minDiff = diff;
          closestShiftId = s.id;
        }
      });

      // Only assign if it's somewhat reasonable (e.g. within 6 hours)
      if (minDiff < 360) {
        recordToShiftAssignment.set(record.id, closestShiftId);
      }
    });

    // For each shift, for each user assigned, find their best record from those that claimed this shift
    currentDayShifts.forEach(shift => {
      const sStart = parse(shift.timeSlot.start, 'HH:mm', new Date(shift.date));
      
      shift.assignedUsers.forEach(user => {
        // Include records that (A) claimed this shift by proximity OR (B) whose actual
        // check-in/check-out interval intersects the scheduled shift interval.
        const perspectiveRecords = attendanceRecords.filter(r => {
          if (r.userId !== user.userId) return false;

          // explicit proximity claim
          if (recordToShiftAssignment.get(r.id) === shift.id) return true;

          // must have a check-in time to intersect
          if (!r.checkInTime) return false;

          const rStart = toDateSafe(r.checkInTime)!;
          const rEnd = r.checkOutTime ? toDateSafe(r.checkOutTime)! : null;
          const shiftStartDt = sStart;
          const shiftEndDt = parse(shift.timeSlot.end, 'HH:mm', new Date(shift.date));

          // intersection exists when record starts before shift end AND (no record end OR record ends after shift start)
          const startsBeforeShiftEnd = rStart <= shiftEndDt;
          const endsAfterShiftStart = !rEnd || rEnd >= shiftStartDt;
          return startsBeforeShiftEnd && endsAfterShiftStart;
        });

        if (perspectiveRecords.length === 0) return;

        // Prefer a record that actually starts inside the shift; otherwise choose the closest start.
        let bestRecordId = '';
        let minDiff = Infinity;

        perspectiveRecords.forEach(r => {
          const rStart = toDateSafe(r.checkInTime)!;
          const shiftEndDt = parse(shift.timeSlot.end, 'HH:mm', new Date(shift.date));

          if (isWithinInterval(rStart, { start: sStart, end: shiftEndDt })) {
            bestRecordId = r.id;
            minDiff = 0;
            return;
          }

          const diff = Math.abs(differenceInMinutes(rStart, sStart));
          if (diff < minDiff) {
            minDiff = diff;
            bestRecordId = r.id;
          }
        });

        if (bestRecordId) {
          shiftUserToRecordAssignment.set(`${shift.id}_${user.userId}`, bestRecordId);
        }
      });
    });

    const usedRecordIds = new Set<string>();

    const todayShifts =
      currentDayShifts
        .map((shift) => {
          const shiftStart = parse(shift.timeSlot.start, 'HH:mm', new Date(shift.date));
          const shiftEnd = parse(shift.timeSlot.end, 'HH:mm', new Date(shift.date));
          const isActive = isWithinInterval(now, { start: shiftStart, end: shiftEnd });

          const employees = shift.assignedUsers.map((assignedUser) => {
            const userRecords = recordsByUser[assignedUser.userId] || [];
            const userShifts = userToShiftsMap[assignedUser.userId] || [];

            // Logic: "don't show the checkin time if the user's second shift if the first shift is not passed and the second has not come yet"
            const hasStarted = isAfter(new Date(), shiftStart);
            const isFirstShiftActive = userShifts.some(otherS => {
              if (otherS.id === shift.id) return false;
              const otherStart = parse(otherS.timeSlot.start, 'HH:mm', new Date(otherS.date));
              const otherEnd = parse(otherS.timeSlot.end, 'HH:mm', new Date(otherS.date));
              return isBefore(otherStart, shiftStart) && isBefore(new Date(), otherEnd);
            });

            const assignedRecordId = shiftUserToRecordAssignment.get(`${shift.id}_${assignedUser.userId}`);
            const nearestRecord = (assignedRecordId && !isFirstShiftActive)
              ? userRecords.find(r => r.id === assignedRecordId)
              : null;

            // If a record spans multiple shifts, nearestRecord may still be used for more than one shift — keep it marked used
            if (nearestRecord) usedRecordIds.add(nearestRecord.id);

            let status: 'present' | 'late' | 'absent' | 'pending_late' = 'absent';
            let checkInTime: Date | null = null;
            let checkOutTime: Date | null = null;
            let lateMinutes: number | null = null;
            let lateReason: string | null = null;
            let lateReasonPhotoUrl: string | null = null;
            let estimatedLateMinutes: number | null = null;

            // Helper: clamp date to shift interval
            const clampToShift = (d: Date, start: Date, end: Date) => {
              if (d <= start) return start;
              if (d >= end) return end;
              return d;
            };

            // Helper: get display times for continuous work across multiple shifts
            const getContinuousWorkTimes = (record: AttendanceRecord, currentShift: AssignedShift, userShifts: AssignedShift[]) => {
              // Sort user shifts by start time
              const sortedShifts = [...userShifts].sort((a, b) => {
                const aStart = parse(a.timeSlot.start, 'HH:mm', new Date(a.date));
                const bStart = parse(b.timeSlot.start, 'HH:mm', new Date(b.date));
                return aStart.getTime() - bStart.getTime();
              });
              
              const currentIndex = sortedShifts.findIndex(s => s.id === currentShift.id);
              const prevShift = sortedShifts[currentIndex - 1];
              const nextShift = sortedShifts[currentIndex + 1];
              
              const recStart = record.checkInTime ? toDateSafe(record.checkInTime)! : null;
              const recEnd = record.checkOutTime ? toDateSafe(record.checkOutTime)! : null;
              
              const shiftStartDt = parse(currentShift.timeSlot.start, 'HH:mm', new Date(currentShift.date));
              const shiftEndDt = parse(currentShift.timeSlot.end, 'HH:mm', new Date(currentShift.date));
              const nowDt = new Date();
              
              // Determine check-in time
              let checkInTime: Date | null = null;
              if (recStart) {
                if (recStart >= shiftStartDt && recStart <= shiftEndDt) {
                  // Actual check-in falls within this shift
                  checkInTime = recStart;
                } else if (prevShift && currentIndex > 0) {
                  // For continuous work: if there's a previous shift, show current shift start as check-in
                  checkInTime = shiftStartDt;
                } else {
                  // Default to shift start
                  checkInTime = shiftStartDt;
                }
              }
              
              // Determine check-out time
              let checkOutTime: Date | null = null;
              if (recEnd) {
                if (recEnd >= shiftStartDt && recEnd <= shiftEndDt) {
                  // Actual check-out falls within this shift
                  checkOutTime = isAfter(nowDt, recEnd) || +recEnd <= +nowDt ? recEnd : null;
                } else if (recEnd > shiftEndDt) {
                  // User checked out after this shift ended - show the actual check-out time
                  checkOutTime = recEnd;
                }
              } else {
                // No checkout yet (in-progress).
                // Only set auto-checkout if there is a next shift and it has started.
                if (nextShift && currentIndex < sortedShifts.length - 1) {
                  const nextShiftStart = parse(nextShift.timeSlot.start, 'HH:mm', new Date(nextShift.date));
                  // If next shift has started, assume continuous work and close this shift at next shift start
                  if (nowDt >= nextShiftStart) {
                    checkOutTime = nextShiftStart;
                  } else {
                    checkOutTime = null;
                  }
                } else {
                  // Single shift or last shift - if not checked out, leave empty
                  checkOutTime = null;
                }
              }
              
              return { checkInTime, checkOutTime };
            };

            if (nearestRecord) {
              // Record may be a pending_late (no checkInTime) or a real check-in record with optional checkOutTime
              if (nearestRecord.status === 'pending_late') {
                status = 'pending_late';
                estimatedLateMinutes = typeof nearestRecord.estimatedLateMinutes === 'number' ? nearestRecord.estimatedLateMinutes : null;
                lateReason = nearestRecord.lateReason || (estimatedLateMinutes ? `Dự kiến trễ ${estimatedLateMinutes} phút` : null);
                lateReasonPhotoUrl = nearestRecord.lateReasonPhotoUrl || null;
              } else if (nearestRecord.checkInTime) {
                const recStart = toDateSafe(nearestRecord.checkInTime)!;
                const recEnd = nearestRecord.checkOutTime ? toDateSafe(nearestRecord.checkOutTime)! : null;
                const shiftStartDt = shiftStart;
                const shiftEndDt = shiftEnd;
                
                // If the record interval intersects this shift, compute per-shift displayed times
                const intersects = recStart <= shiftEndDt && (!recEnd || recEnd >= shiftStartDt);
                
                if (intersects) {
                  // Use the clean helper function to get display times for continuous work
                  const userShifts = userToShiftsMap[assignedUser.userId] || [];
                  const { checkInTime: displayCheckIn, checkOutTime: displayCheckOut } = 
                    getContinuousWorkTimes(nearestRecord, shift, userShifts);
                  
                  checkInTime = displayCheckIn;
                  checkOutTime = displayCheckOut;

                  // Pull lateReason fields from the record when relevant
                  if (nearestRecord.lateReason) lateReason = nearestRecord.lateReason;
                  if (nearestRecord.lateReasonPhotoUrl) lateReasonPhotoUrl = nearestRecord.lateReasonPhotoUrl;
                  if (nearestRecord.estimatedLateMinutes && nearestRecord.estimatedLateMinutes > 0) estimatedLateMinutes = nearestRecord.estimatedLateMinutes;

                  // Determine status and lateMinutes using the displayed checkInTime vs the adjusted shift start
                  const shiftStartTime = parse(shift.timeSlot.start, 'HH:mm', new Date(shift.date));
                  if (shiftStartTime.getHours() < 6) shiftStartTime.setHours(6, 0, 0, 0);
                  const staff = allUsers.find((u: any) => u.id === assignedUser.userId || u.uid === assignedUser.userId || u.userId === assignedUser.userId);
                  if (staff?.role === 'Quản lý' && shiftStartTime.getHours() === 6) shiftStartTime.setHours(7, 0, 0, 0);

                  if (checkInTime) {
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
                  // nearestRecord does not intersect this shift (defensive) — treat as absent for this shift
                  status = 'absent';
                }
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
              lateReasonPhotoUrl,
              estimatedLateMinutes,
            };
          });
          return { ...shift, employees, isActive };
        }) || [];

    const offShiftEmployees: any[] = [];
    attendanceRecords.forEach(record => {
      if (!usedRecordIds.has(record.id)) {
        const user = allUsers.find(u => u.uid === record.userId || (u as any).id === record.userId);
        offShiftEmployees.push({
          id: record.id,
          name: user?.displayName || record.userId,
          status: 'off-shift',
          checkInTime: toDateSafe(record.checkInTime),
          checkOutTime: toDateSafe(record.checkOutTime),
          lateMinutes: null,
          lateReason: record.offShiftReason || record.lateReason || null,
          lateReasonPhotoUrl: record.lateReasonPhotoUrl || null,
          estimatedLateMinutes: record.estimatedLateMinutes || null,
        });
      }
    });

    return {
      todayShifts,
      offShiftEmployees,
    };
  }, [attendanceRecords, todaysSchedule, allUsers, dateFilter]);

  const kpiMetrics = useMemo(() => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const todayShifts = todaysSchedule?.shifts.filter((s) => s.date === todayStr) || [];

    const presentCount = attendanceOverview.todayShifts.reduce((count, shift) => {
      const presentEmployees = shift.employees.filter((e) => e.status === 'present' || e.status === 'late').length;
      return count + presentEmployees;
    }, 0) + (attendanceOverview.offShiftEmployees?.length || 0);

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

  const filteredIncidents = useMemo(() => {
    if (dateFilter === 'week') {
      const start = startOfWeek(new Date(), { weekStartsOn: 1 });
      const end = endOfWeek(new Date(), { weekStartsOn: 1 });
      return incidents.filter((i) => {
        const date = parse(i.date, 'yyyy-MM-dd', new Date());
        return isWithinInterval(date, { start, end });
      });
    } else {
      const targetDate = dateFilter === 'yesterday' ? addDays(new Date(), -1) : new Date();
      const targetDateStr = format(targetDate, 'yyyy-MM-dd');
      return incidents.filter((i) => i.date === targetDateStr);
    }
  }, [incidents, dateFilter]);

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
      <main className="flex-1 overflow-y-auto px-1 py-3 md:p-6 lg:p-8 scroll-smooth">
        <div className="flex flex-col gap-4 md:gap-6 pb-20 md:pb-8">
          {/* KPI Metrics */}
          <KPIMetricsSection
            metrics={kpiMetrics}
            onViewDetails={() => setIsCashierDataDialogOpen(true)}
          />

          {/* Main content grid: Analytics + Cards */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 md:gap-6">
            {/* Left: Revenue Analytics (2 cols) */}
            <div className="xl:col-span-2 flex flex-col gap-4 md:gap-6">
              <RevenueAnalyticsSection
                revenueByMethod={cashierOverview.revenueByMethod}
                totalRevenue={cashierOverview.totalRevenue}
              />
              {/* Schedule */}
              <TodaysScheduleSection 
                shifts={todayShifts} 
                offShiftEmployees={attendanceOverview.offShiftEmployees}
              />
            </div>

            {/* Right column: Quick access + Tasks (1 col) */}
            <div className="flex flex-col gap-4 md:gap-6">
              <QuickAccessToolsSection onNavigate={(path) => {
                if (path === 'create-monthly-report') {
                  setIsMonthlyReportOpen(true);
                } else if (path === 'salary-management') {
                  setIsSalaryDialogOpen(true);
                } else {
                  nav.push(path);
                }
              }} />
              <MonthlyStaffReportDialog isOpen={isMonthlyReportOpen} onOpenChange={(open: boolean) => setIsMonthlyReportOpen(open)} parentDialogTag="root" />
              <SalaryManagementDialog isOpen={isSalaryDialogOpen} onClose={() => setIsSalaryDialogOpen(false)} allUsers={allUsers} parentDialogTag="root" />
              <RecurringTasksCard monthlyTasks={monthlyTasks} taskAssignments={taskAssignments} staffDirectory={allUsers} />
            </div>
          </div>

          {/* Reports */}
          <div>
            <RecentReportsCard shiftReports={shiftReports} />
          </div>
        </div>
      </main>

      <CashierDataDialog
        isOpen={isCashierDataDialogOpen}
        onOpenChange={setIsCashierDataDialogOpen}
        dateLabel={dateFilter === 'today' ? 'Hôm nay' : dateFilter === 'yesterday' ? 'Hôm qua' : 'Tuần này'}
        revenueStats={revenueStats}
        expenseSlips={dailySlips}
        incidents={filteredIncidents}
        inventoryList={inventoryList}
        handoverByDate={handoverByDate}
      />
    </div>
  );
}
