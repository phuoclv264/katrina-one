'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSearch, ClipboardList, Archive, ShieldX, CalendarDays, CheckSquare, Banknote, Loader2, Info, UserCog, ClockIcon, MessageSquare, CalendarCheck } from 'lucide-react';
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
import { LoadingPage } from '@/components/loading/LoadingPage';

export function ManagerHomeView() {
  const { user, loading, todaysShifts } = useAuth();
  const router = useRouter();
  const { showCheckInCardOnTop, isCheckedIn } = useCheckInCardPlacement();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [todaysMonthlyAssignments, setTodaysMonthlyAssignments] = useState<MonthlyTaskAssignment[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);

  useEffect(() => {
    if (!loading && user && (user.role !== 'Quản lý' && user.role !== 'Chủ nhà hàng' && !user.secondaryRoles?.includes('Quản lý'))) {
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
  const hasBartenderSecondaryRole = user.secondaryRoles?.includes('Pha chế');
  const hasCashierSecondaryRole = user.secondaryRoles?.includes('Thu ngân');

  const shiftsText = todaysShifts.map(s => `${s.label} (${s.timeSlot.start}-${s.timeSlot.end})`).join(', ');

  return (
    <DashboardLayout
      title={<span className="flex items-center gap-2"><UserCog /> Bảng điều khiển Quản lý</span>}
      description={todaysShifts.length > 0 ? `Hôm nay bạn có ca: ${shiftsText}. Chọn chức năng để thực hiện.` : 'Bạn không có ca làm việc nào hôm nay.'}
      top={isCheckedIn && todaysMonthlyAssignments.length > 0 ? <TodaysTasksCard assignments={todaysMonthlyAssignments} shiftTemplates={shiftTemplates} /> : undefined}
    >
      {isCheckedIn ? (
        <Button size="lg" onClick={() => router.push('/manager/comprehensive-report')}>
          <FileSearch className="mr-2" />
          Phiếu kiểm tra toàn diện
        </Button>
      ) : (
        <Alert variant="default" className="border-amber-500/30 bg-amber-500/10">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">Chưa chấm công</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Vui lòng chấm công để truy cập các chức năng quản lý.
          </AlertDescription>
        </Alert>
      )}

      <Button size="lg" variant="outline" onClick={() => router.push('/reports')}>
        <CheckSquare className="mr-2" />
        Xem Báo cáo
      </Button>
      <Separator className="my-2" />
      <Button size="lg" variant="outline" onClick={() => router.push('/schedule')}>
        <CalendarDays className="mr-2" />
        Lịch làm việc
      </Button>
      
      <Button size="lg" variant="outline" onClick={() => router.push('/violations')}>
        <ShieldX className="mr-2" />
        Ghi nhận Vi phạm
      </Button>
      <Button size="lg" variant="outline" onClick={() => router.push('/reports-feed')}>
        <MessageSquare className="mr-2" />
        Tố cáo
      </Button>

      {isCheckedIn && (hasServerSecondaryRole || hasBartenderSecondaryRole || hasCashierSecondaryRole) && <Separator className="my-2" />}

      {isCheckedIn && hasServerSecondaryRole && (
        <>
          <p className="text-sm font-medium text-muted-foreground text-center">Vai trò phụ: Phục vụ</p>
          <Button size="lg" variant="outline" onClick={() => router.push('/shifts')}>
            <CheckSquare className="mr-2" />
            Checklist Công việc
          </Button>
        </>
      )}

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
      
      {isCheckedIn && hasCashierSecondaryRole && (
        <>
          <p className="text-sm font-medium text-muted-foreground text-center">Vai trò phụ: Thu ngân</p>
          <Button size="lg" variant="outline" onClick={() => router.push('/cashier')}>
            <Banknote className="mr-2" />
            Báo cáo Thu ngân
          </Button>
        </>
      )}
    </DashboardLayout>
  );
}
