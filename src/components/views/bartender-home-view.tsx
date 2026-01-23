'use client';

import { ClipboardList, Archive, Info } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState, useCallback } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCheckInCardPlacement } from '@/hooks/useCheckInCardPlacement';
import TodaysTasksCard from '@/app/(app)/monthly-tasks/_components/task-reporting-card';
import DashboardLayout from '@/components/dashboard-layout';
import type { MonthlyTaskAssignment } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { useAppNavigation } from '@/contexts/app-navigation-context';

export function BartenderHomeView() {
  const { user, loading, todaysShifts } = useAuth();
  const nav = useAppNavigation();
  const { isCheckedIn } = useCheckInCardPlacement();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [todaysMonthlyAssignments, setTodaysMonthlyAssignments] = useState<MonthlyTaskAssignment[]>([]);

  useEffect(() => {
    if (!loading && user && (user.role !== 'Pha chế' && !user.secondaryRoles?.includes('Pha chế'))) {
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
      title="Báo cáo Pha chế"
      description={todaysShifts.length > 0 ? `Hôm nay bạn có ca: ${shiftsText}. Chọn báo cáo để thực hiện.` : 'Bạn không có ca làm việc nào hôm nay.'}
      top={isCheckedIn && todaysMonthlyAssignments.length > 0 ? <TodaysTasksCard assignments={todaysMonthlyAssignments} /> : undefined}
    >
      {/* Primary action cards are rendered by DashboardLayout now. Keep the alert here. */}
      {!isCheckedIn && (
        <Alert variant="default" className="border-amber-500/30 bg-amber-500/10">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">Chưa chấm công</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Vui lòng chấm công để bắt đầu thực hiện báo cáo.
          </AlertDescription>
        </Alert>
      )} 

    </DashboardLayout>
  );
}
