'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSearch, ClipboardList, Archive, ShieldX, CalendarDays, CheckSquare, Banknote, Loader2, Info, UserCog, ClockIcon, MessageSquare, CalendarCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCheckInCardPlacement } from '@/hooks/useCheckInCardPlacement';
import TodaysTasksCard from '@/app/(app)/monthly-tasks/_components/task-reporting-card';
import DashboardLayout from '@/components/dashboard-layout';
import type { MonthlyTaskAssignment, ShiftTemplate } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { DashboardActionCard } from '@/components/dashboard-action-card';
import { useAppNavigation } from '@/contexts/app-navigation-context';

export function ManagerHomeView() {
  const { user, loading, todaysShifts } = useAuth();
  const nav = useAppNavigation();
  const { isCheckedIn } = useCheckInCardPlacement();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [todaysMonthlyAssignments, setTodaysMonthlyAssignments] = useState<MonthlyTaskAssignment[]>([]);

  useEffect(() => {
    if (!loading && user && (user.role !== 'Quản lý' && user.role !== 'Chủ nhà hàng' && !user.secondaryRoles?.includes('Quản lý'))) {
      nav.replace('/');
    }
  }, [user, loading, nav]);

  const handleReconnect = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (user) {
      const unsubTasks = dataStore.subscribeToMonthlyTasksForDateForStaff(new Date(), user.uid, setTodaysMonthlyAssignments);
      return () => {
        unsubTasks();
      };
    }
  }, [user, refreshTrigger]);

  useDataRefresher(handleReconnect);

  if (loading || !user) {
    return <LoadingPage />;
  }

  const shiftsText = todaysShifts.map(s => `${s.label} (${s.timeSlot.start}-${s.timeSlot.end})`).join(', ');

  return (
    <DashboardLayout
      title={<span className="flex items-center gap-2"><UserCog /> Bảng điều khiển Quản lý</span>}
      description={todaysShifts.length > 0 ? `Hôm nay bạn có ca: ${shiftsText}. Chọn chức năng để thực hiện.` : 'Bạn không có ca làm việc nào hôm nay.'}
      top={isCheckedIn && todaysMonthlyAssignments.length > 0 ? <TodaysTasksCard assignments={todaysMonthlyAssignments} /> : undefined}
    >
      {isCheckedIn ? (
        <div className="grid grid-cols-2 gap-3">
          <DashboardActionCard
            label="Phiếu kiểm tra toàn diện"
            subLabel="Định kỳ"
            icon={FileSearch}
            onClick={() => nav.push('/manager/comprehensive-report')}
            color="orange"
            className="col-span-2"
            variant="primary"
          />
          <DashboardActionCard
            label="Xem Báo cáo"
            subLabel="Quản lý"
            icon={CheckSquare}
            onClick={() => nav.push('/reports')}
            color="blue"
            variant="primary"
          />
        </div>
      ) : (
        <Alert variant="default" className="border-amber-500/30 bg-amber-500/10">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">Chưa chấm công</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Vui lòng chấm công để truy cập các chức năng quản lý.
          </AlertDescription>
        </Alert>
      )}

      {!isCheckedIn && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <DashboardActionCard
            label="Xem Báo cáo"
            subLabel="Quản lý"
            icon={CheckSquare}
            onClick={() => nav.push('/reports')}
            color="blue"
          />
        </div>
      )}
    </DashboardLayout>
  );
}
