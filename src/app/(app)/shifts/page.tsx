
'use client';

import { Button } from '@/components/ui/button';
import { Sun, Moon, Sunset, ShieldX, CalendarDays, Info, MessageSquare } from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import { useAuth } from '@/hooks/use-auth';
import { useMemo } from 'react';
import { StaffDashboardClient } from '../_components/staff-dashboard-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const mainShiftInfo: { [key: string]: { name: string, icon: React.ElementType, href: string } } = {
    sang: { name: "Ca Sáng", icon: Sun, href: "/checklist/sang" },
    trua: { name: "Ca Trưa", icon: Sunset, href: "/checklist/trua" },
    toi: { name: "Ca Tối", icon: Moon, href: "/checklist/toi" },
};

const mainShiftTimeFrames: { [key in "sang" | "trua" | "toi"]: { start: number; end: number } } = {
  sang: { start: 6, end: 12 },
  trua: { start: 12, end: 17 },
  toi: { start: 17, end: 23 },
};

export default function ShiftsPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const activeMainShiftKeys = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const keys = new Set<"sang" | "trua" | "toi">();
    
    for (const key in mainShiftTimeFrames) {
      const shiftKey = key as "sang" | "trua" | "toi";
      const frame = mainShiftTimeFrames[shiftKey];
      
      const validStartTime = frame.start - 1;
      const validEndTime = frame.end + 1;
      
      if (currentHour >= validStartTime && currentHour < validEndTime) {
        keys.add(shiftKey);
      }
    }

    return Array.from(keys);
  }, []);

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
      allowedRoles={['Phục vụ']}
      pageTitle="Checklist Công việc"
      utilityActions={utilityActions}
    >
      {user?.isCheckedIn && activeMainShiftKeys.length > 0 ? (
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
            {(!user?.isCheckedIn && activeMainShiftKeys.length > 0) ?
            `Chấm công vào để thực hiện báo cáo công việc.` :
            `Vui lòng kiểm tra lịch và quay lại khi đến giờ làm việc của bạn.`
          }
          </AlertDescription>
        </Alert>
      )}
    </StaffDashboardClient>
  );
}
