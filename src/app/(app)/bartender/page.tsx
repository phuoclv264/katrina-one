
'use client';

import { Button } from '@/components/ui/button';
import { ClipboardList, Archive, ShieldX, CalendarDays, CheckSquare, FileSearch, Banknote, Info, MessageSquare } from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import { useAuth } from '@/hooks/use-auth';
import { StaffDashboardClient } from '../_components/staff-dashboard-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function BartenderDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  const utilityActions = (
    <>
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
  );

  return (
    <StaffDashboardClient
      userRole={user?.role || null}
      allowedRoles={['Pha chế']}
      pageTitle="Danh mục Báo cáo Pha chế"
      utilityActions={utilityActions}
    >
      {user?.isCheckedIn ? (
        <>
          <Button size="lg" onClick={() => router.push('/bartender/hygiene-report')}>
            <ClipboardList className="mr-2" />
            Báo cáo Vệ sinh quầy
          </Button>
          <Button size="lg" onClick={() => router.push('/bartender/inventory')}>
            <Archive className="mr-2" />
            Kiểm kê Tồn kho
          </Button>
        </>
      ) : (
        <Alert variant="default" className="border-amber-500/30 bg-amber-500/10">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">Chưa chấm công</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Vui lòng chấm công để bắt đầu thực hiện báo cáo.
          </AlertDescription>
        </Alert>
      )}
    </StaffDashboardClient>
  );
}
