'use client';

import { isWithinInterval, set } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Sunset, ShieldX, CalendarDays, Loader2, Info, CheckSquare, ClipboardList, Archive, FileSearch, Banknote, Coffee, UserCog, ClockIcon, MessageSquare } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'nextjs-toploader/app';
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
import { DashboardActionCard } from '@/components/dashboard-action-card';
import { LoadingPage } from '../loading/LoadingPage';

const mainShiftInfo: { [key: string]: { name: string, icon: React.ElementType, href: string } } = {
    sang: { name: "Báo cáo ca sáng", icon: Sun, href: "/checklist/sang" },
    trua: { name: "Báo cáo ca trưa", icon: Sunset, href: "/checklist/trua" },
    toi: { name: "Báo cáo ca tối", icon: Moon, href: "/checklist/toi" },
};

const mainShiftTimeFrames: { [key in "sang" | "trua" | "toi"]: { start: number; end: number } } = {
  sang: { start: 6, end: 12 },   // 6:00 AM - 12:00 PM
  trua: { start: 12, end: 17 },  // 12:00 PM - 5:00 PM
  toi: { start: 17, end: 23 },   // 5:00 PM - 11:00 PM
};

export function ServerHomeView() {
  const { user, loading: authLoading, activeShifts, todaysShifts } = useAuth();
  const router = useRouter();
  const { showCheckInCardOnTop, isCheckedIn } = useCheckInCardPlacement();
  const [todaysMonthlyAssignments, setTodaysMonthlyAssignments] = useState<MonthlyTaskAssignment[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);

  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const handleDataRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    if (!authLoading && user && (user.role !== 'Phục vụ' && !user.secondaryRoles?.includes('Phục vụ'))) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

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

  useDataRefresher(handleDataRefresh);
  
  const hasBartenderSecondaryRole = user?.secondaryRoles?.includes('Pha chế');
  const hasManagerSecondaryRole = user?.secondaryRoles?.includes('Quản lý');
  const hasCashierSecondaryRole = user?.secondaryRoles?.includes('Thu ngân');
  const isPrimaryServer = user?.role === 'Phục vụ';

  const activeMainShiftKeys = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const keys = new Set<"sang" | "trua" | "toi">();
    
    // We check a window from 1 hour before the shift starts to 1 hour after it ends.
    for (const key in mainShiftTimeFrames) {
      const shiftKey = key as "sang" | "trua" | "toi";
      const frame = mainShiftTimeFrames[shiftKey];
      
      const validStartTime = frame.start - 1;
      const validEndTime = frame.end + 1;
      
      // Check if the current hour is within the valid window for the shift
      if (currentHour >= validStartTime && currentHour < validEndTime) {
        keys.add(shiftKey);
      }
    }

    return Array.from(keys);
  }, []);

  if (authLoading) {
    return <LoadingPage />;
  }

  if (!user) {
    return null;
  }

  const shiftsText = todaysShifts.map(s => `${s.label} (${s.timeSlot.start}-${s.timeSlot.end})`).join(', ');

  return (
    <DashboardLayout
      title="Checklist Công việc"
      description={todaysShifts.length > 0 ? `Hôm nay bạn có ca: ${shiftsText}. Chọn ca để báo cáo.` : 'Bạn không có ca làm việc nào hôm nay, liên hệ chủ quán để thay đổi lịch làm.'}
      top={isCheckedIn && todaysMonthlyAssignments.length > 0 ? <TodaysTasksCard assignments={todaysMonthlyAssignments} shiftTemplates={shiftTemplates} /> : undefined}
    >
      {isCheckedIn && activeMainShiftKeys.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {activeMainShiftKeys.map((key) => {
            const info = mainShiftInfo[key];
            if (!info) return null;
            return (
              <DashboardActionCard
                key={key}
                label={info.name}
                subLabel="Báo cáo ca"
                icon={info.icon}
                onClick={() => router.push(info.href)}
                color="blue"
                variant="primary"
              />
            );
          })}
        </div>
      ) : (
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
