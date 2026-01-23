'use client';

import { isWithinInterval, set } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Sunset, ShieldX, CalendarDays, Loader2, Info, CheckSquare, ClipboardList, Archive, FileSearch, Banknote, Coffee, UserCog, ClockIcon, MessageSquare } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { useEffect, useMemo, useCallback } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useCheckInCardPlacement } from '@/hooks/useCheckInCardPlacement';
import TodaysTasksCard from '@/app/(app)/monthly-tasks/_components/task-reporting-card';
import DashboardLayout from '@/components/dashboard-layout';
import type { MonthlyTaskAssignment, ShiftTemplate } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { useState } from 'react';
import { format } from 'date-fns';
import { LoadingPage } from '../loading/LoadingPage';
import { useAppNavigation } from '@/contexts/app-navigation-context';

const mainShiftInfo: { [key: string]: { name: string, icon: React.ElementType, href: string } } = {
    sang: { name: "Báo cáo ca sáng", icon: Sun, href: "/checklist/sang" },
    trua: { name: "Báo cáo ca trưa", icon: Sunset, href: "/checklist/trua" },
    toi: { name: "Báo cáo ca tối", icon: Moon, href: "/checklist/toi" },
};

// Use a shared canonical time-frame (keeps behavior consistent across views/menus)
import { DEFAULT_MAIN_SHIFT_TIMEFRAMES, getActiveShiftKeys } from '@/lib/shift-utils';
const mainShiftTimeFrames = DEFAULT_MAIN_SHIFT_TIMEFRAMES;

export function ServerHomeView() {
  const { user, loading: authLoading, activeShifts, todaysShifts } = useAuth();
  const nav = useAppNavigation();
  const { showCheckInCardOnTop, isCheckedIn } = useCheckInCardPlacement();
  const [todaysMonthlyAssignments, setTodaysMonthlyAssignments] = useState<MonthlyTaskAssignment[]>([]);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const handleDataRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!authLoading && user && (user.role !== 'Phục vụ' && !user.secondaryRoles?.includes('Phục vụ'))) {
      nav.replace('/');
    }
  }, [user, authLoading, nav]);

  useEffect(() => {
    if (user) {
      const unsubTasks = dataStore.subscribeToMonthlyTasksForDateForStaff(new Date(), user.uid, setTodaysMonthlyAssignments);
      return () => {
        unsubTasks();
      };
    }
  }, [user, refreshTrigger]);

  useDataRefresher(handleDataRefresh);
  
  const activeMainShiftKeys = useMemo(() => getActiveShiftKeys(mainShiftTimeFrames), [/* intentionally stable */]);

  if (authLoading) {
    return <LoadingPage />;
  }

  if (!user) {
    return null;
  }

  const shiftsText = todaysShifts.map(s => `${s.label} (${s.timeSlot.start}-${s.timeSlot.end})`).join(', ');
  const handleNavigate = (href: string) => {
    nav.push(href);
  };

  return (
    <DashboardLayout
      title="Checklist Công việc"
      description={todaysShifts.length > 0 ? `Hôm nay bạn có ca: ${shiftsText}. Chọn ca để báo cáo.` : 'Bạn không có ca làm việc nào hôm nay, liên hệ chủ quán để thay đổi lịch làm.'}
      top={isCheckedIn && todaysMonthlyAssignments.length > 0 ? <TodaysTasksCard assignments={todaysMonthlyAssignments} /> : undefined}
    >
      {/* Primary action cards are rendered by DashboardLayout now. Keep the alert/fallback here. */}
      {! (isCheckedIn && activeMainShiftKeys.length > 0) && (
        <Alert variant="default" className="border-amber-500/30 bg-amber-500/10">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">Không trong ca làm việc</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            {(!isCheckedIn && activeMainShiftKeys.length > 0) ? 
            `Chấm công vào để thực hiện báo cáo công việc.` :
            `Vui lòng kiểm tra lịch và quay lại khi đến giờ làm việc của bạn.`
          }
          </AlertDescription>
        </Alert>
      )} 

    </DashboardLayout>
  );
}
