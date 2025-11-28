
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
import CheckInCard from '../_components/check-in-card';
import { useCheckInCardPlacement } from '@/hooks/useCheckInCardPlacement';
import TodaysTasksCard from '../monthly-tasks/_components/task-reporting-card';
import type { MonthlyTaskAssignment, ShiftTemplate } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { useState } from 'react';
import { format } from 'date-fns';
import { LoadingPage } from '@/components/loading/LoadingPage';

const mainShiftInfo: { [key: string]: { name: string, icon: React.ElementType, href: string } } = {
    sang: { name: "Ca Sáng", icon: Sun, href: "/checklist/sang" },
    trua: { name: "Ca Trưa", icon: Sunset, href: "/checklist/trua" },
    toi: { name: "Ca Tối", icon: Moon, href: "/checklist/toi" },
};

const mainShiftTimeFrames: { [key in "sang" | "trua" | "toi"]: { start: number; end: number } } = {
  sang: { start: 6, end: 12 },   // 6:00 AM - 12:00 PM
  trua: { start: 12, end: 17 },  // 12:00 PM - 5:00 PM
  toi: { start: 17, end: 23 },   // 5:00 PM - 11:00 PM
};

export default function ShiftsPage() {
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
    <div className="container mx-auto flex min-h-full items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-md space-y-6">
        {showCheckInCardOnTop && <CheckInCard />}
        {isCheckedIn && todaysMonthlyAssignments.length > 0 && <TodaysTasksCard assignments={todaysMonthlyAssignments} shiftTemplates={shiftTemplates} />}
        
        <Card>
          <CardHeader>
            <CardTitle>Checklist Công việc</CardTitle>
            <CardDescription>
              {todaysShifts.length > 0
                ? `Hôm nay bạn có ca: ${shiftsText}. Chọn ca để báo cáo.`
                : "Bạn không có ca làm việc nào hôm nay, liên hệ chủ quán để thay đổi lịch làm."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
              {isCheckedIn && activeMainShiftKeys.length > 0 ? (
                  activeMainShiftKeys.map((key) => {
                    const info = mainShiftInfo[key];
                    if (!info) return null;
                    const Icon = info.icon;
                    return (
                      <Button size="lg" key={key} onClick={() => router.push(info.href)}>
                        <Icon className="mr-2" />
                        {info.name}
                      </Button>
                    );
                  })
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

            {isPrimaryServer && (
              <>
                <Separator className="my-2" />
                <Button size="lg" variant="outline" onClick={() => router.push('/schedule')}>
                  <CalendarDays className="mr-2" />
                  Lịch làm việc
                </Button>
                <Button size="lg" variant="outline" onClick={() => router.push('/violations')}>
                  <ShieldX className="mr-2" />
                  Danh sách Vi phạm
                </Button>
                <Button size="lg" variant="outline" onClick={() => router.push('/reports-feed')}>
                  <MessageSquare className="mr-2" />
                  Tố cáo
                </Button>
              </>
            )}

            {isCheckedIn && (hasBartenderSecondaryRole || hasManagerSecondaryRole || hasCashierSecondaryRole) && <Separator className="my-2" />}

            {isCheckedIn && hasBartenderSecondaryRole && (
              <>
                <p className="text-sm font-medium text-muted-foreground text-center">Vai trò phụ: Pha chế</p>
                <Button size="lg" variant="outline" onClick={() => router.push('/bartender/hygiene-report')}>
                  <ClipboardList className="mr-2" />
                  Báo cáo Vệ sinh quầy
                </Button>
                <Button size="lg" variant="outline" onClick={() => router.push('/bartender/inventory')}>
                  <Archive className="mr-2" />
                  Kiểm kê Tồn kho
                </Button>
              </>
            )}

            {isCheckedIn && hasManagerSecondaryRole && (
              <>
                <p className="text-sm font-medium text-muted-foreground text-center">Vai trò phụ: Quản lý</p>
                 <Button size="lg" variant="outline" onClick={() => router.push('/manager/comprehensive-report')}>
                  <FileSearch className="mr-2" />
                  Phiếu kiểm tra toàn diện
                </Button>
              </>
            )}
            
            {isCheckedIn && hasCashierSecondaryRole && (
                <>
                <p className="text-sm font-medium text-muted-foreground text-center">Vai trò phụ: Thu ngân</p>
                 <Button size="lg" variant="outline" onClick={() => router.push('/cashier')}>
                  <Banknote className="mr-2" />
                  Báo cáo Thu ngân
                </Button>
              </>
            )}

          </CardContent>
        </Card>
        {!showCheckInCardOnTop && <CheckInCard />}
      </div>
    </div>
  );
}
