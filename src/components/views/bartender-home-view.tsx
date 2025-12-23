'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, Archive, ShieldX, CalendarDays, CheckSquare, FileSearch, Banknote, Loader2, Info, ClockIcon, MessageSquare } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'nextjs-toploader/app';
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCheckInCardPlacement } from '@/hooks/useCheckInCardPlacement';
import TodaysTasksCard from '@/app/(app)/monthly-tasks/_components/task-reporting-card';
import DashboardLayout from '@/components/dashboard-layout';
import type { MonthlyTaskAssignment, ShiftTemplate } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { format } from 'date-fns';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { DashboardActionCard } from '@/components/dashboard-action-card';

export function BartenderHomeView() {
  const { user, loading, todaysShifts } = useAuth();
  const router = useRouter();
  const { showCheckInCardOnTop, isCheckedIn } = useCheckInCardPlacement();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [todaysMonthlyAssignments, setTodaysMonthlyAssignments] = useState<MonthlyTaskAssignment[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);

  useEffect(() => {
    if (!loading && user && (user.role !== 'Pha chế' && !user.secondaryRoles?.includes('Pha chế'))) {
      router.replace('/');
    }
  }, [user, loading, router]);
  
  const handleReconnect = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (user) {
      const unsubTasks = dataStore.subscribeToMonthlyTasksForDate(new Date(), setTodaysMonthlyAssignments);
      const unsubTemplates = dataStore.subscribeToShiftTemplates(setShiftTemplates);
      return () => {
        unsubTasks();
        unsubTemplates();
      };
    }
  }, [user, refreshTrigger]);

  useDataRefresher(handleReconnect);

  if (loading || !user) {
    return <LoadingPage />;
  }
  
  const hasServerSecondaryRole = user.secondaryRoles?.includes('Phục vụ');
  const hasManagerSecondaryRole = user.secondaryRoles?.includes('Quản lý');
  const hasCashierSecondaryRole = user.secondaryRoles?.includes('Thu ngân');

  const shiftsText = todaysShifts.map(s => `${s.label} (${s.timeSlot.start}-${s.timeSlot.end})`).join(', ');

  return (
    <DashboardLayout
      title="Danh mục Báo cáo Pha chế"
      description={todaysShifts.length > 0 ? `Hôm nay bạn có ca: ${shiftsText}. Chọn báo cáo để thực hiện.` : 'Bạn không có ca làm việc nào hôm nay.'}
      top={isCheckedIn && todaysMonthlyAssignments.length > 0 ? <TodaysTasksCard assignments={todaysMonthlyAssignments} shiftTemplates={shiftTemplates} /> : undefined}
    >
      {isCheckedIn ? (
        <div className="grid grid-cols-2 gap-3">
          <DashboardActionCard
            label="Vệ sinh quầy"
            subLabel="Hàng ngày"
            icon={ClipboardList}
            onClick={() => router.push('/bartender/hygiene-report')}
            color="emerald"
            variant="primary"
          />
          <DashboardActionCard
            label="Kiểm kê kho"
            subLabel="Cuối ca"
            icon={Archive}
            onClick={() => router.push('/bartender/inventory')}
            color="purple"
            variant="primary"
          />
        </div>
      ) : (
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
