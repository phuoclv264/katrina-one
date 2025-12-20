
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'nextjs-toploader/app';
import { useEffect, useMemo, useState, useCallback, ReactNode } from 'react';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import CheckInCard from '../_components/check-in-card';
import { useCheckInCardPlacement } from '@/hooks/useCheckInCardPlacement';
import TodaysTasksCard from '../monthly-tasks/_components/task-reporting-card';
import type { MonthlyTaskAssignment, ShiftTemplate, User } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { MessageSquare, Calendar, User as UserIcon, LayoutDashboard, CalendarDays, ShieldX, ClipboardList, Archive, FileSearch, Banknote, CheckSquare } from 'lucide-react';

type Role = 'Phục vụ' | 'Pha chế' | 'Quản lý' | 'Chủ nhà hàng' | 'Thu ngân';

interface StaffDashboardClientProps {
  userRole: Role | null;
  allowedRoles: Role[];
  pageTitle: string;
  children: ReactNode;
  utilityActions: ReactNode;
}

const NavItem = ({ icon: Icon, label, isActive }: { icon: React.ElementType, label: string, isActive?: boolean }) => (
    <button className={cn("flex flex-col items-center justify-center pt-1 transition-colors", isActive ? "text-primary" : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300")}>
      <Icon className="mb-0.5" size={24} />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
);

export function StaffDashboardClient({ userRole, allowedRoles, pageTitle, children, utilityActions }: StaffDashboardClientProps) {
  const { user, loading, todaysShifts } = useAuth();
  const router = useRouter();
  const { showCheckInCardOnTop, isCheckedIn } = useCheckInCardPlacement();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [todaysMonthlyAssignments, setTodaysMonthlyAssignments] = useState<MonthlyTaskAssignment[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<ShiftTemplate[]>([]);

  useEffect(() => {
    if (!loading && user) {
      const userPrimaryRole = user.role as Role;
      const userSecondaryRoles = (user.secondaryRoles as Role[]) || [];
      const userRoles = [userPrimaryRole, ...userSecondaryRoles];

      const isAllowed = userRoles.some(role => allowedRoles.includes(role));

      if (!isAllowed) {
        router.replace('/');
      }
    }
  }, [user, loading, router, allowedRoles]);

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

  const shiftsText = todaysShifts.map(s => `${s.label} (${s.timeSlot.start}-${s.timeSlot.end})`).join(', ');
  const cardDescription = todaysShifts.length > 0
    ? `Hôm nay bạn có ca: ${shiftsText}.`
    : "Bạn không có ca làm việc nào hôm nay.";

  const getAvatarText = (name: string) => {
    if (!name) return '';
    const parts = name.split(' ');
    if (parts.length > 1) {
      return `${parts[parts.length - 2][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const hasBartenderSecondaryRole = user.secondaryRoles?.includes('Pha chế');
  const hasManagerSecondaryRole = user.secondaryRoles?.includes('Quản lý');
  const hasCashierSecondaryRole = user.secondaryRoles?.includes('Thu ngân');
  const hasServerSecondaryRole = user.secondaryRoles?.includes('Phục vụ');

  return (
    <div className="w-full max-w-md h-full max-h-[900px] bg-background-light dark:bg-background-dark sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col relative border-0 sm:border border-gray-200 dark:border-gray-800">
      <header className="bg-surface-light dark:bg-surface-dark px-5 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm shadow-md">
            {getAvatarText(user.name || 'User')}
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{user.name}</h1>
            <p className="text-xs text-text-sub dark:text-gray-400">{user.role} - {shiftsText}</p>
          </div>
        </div>
        <button className="p-2 -mr-2 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300 relative">
          <span className="material-icons-round text-2xl">notifications_none</span>
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-surface-light dark:border-surface-dark"></span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-50 dark:bg-gray-900 pb-20 scroll-smooth">
        {showCheckInCardOnTop && <CheckInCard />}

        {isCheckedIn && todaysMonthlyAssignments.length > 0 && (
          <TodaysTasksCard assignments={todaysMonthlyAssignments} shiftTemplates={shiftTemplates} />
        )}

        <Card className="bg-surface-light dark:bg-surface-dark rounded-2xl p-5 shadow-soft border border-blue-100 dark:border-blue-900/50 relative overflow-hidden">
          <CardHeader>
            <CardTitle>{pageTitle}</CardTitle>
            <CardDescription>{cardDescription}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {children}

            <Separator className="my-2" />

            {utilityActions}
          </CardContent>
        </Card>

        {isCheckedIn && (hasBartenderSecondaryRole || hasManagerSecondaryRole || hasCashierSecondaryRole || hasServerSecondaryRole) && (
          <div>
             <h2 className="text-base font-bold text-gray-900 dark:text-white mb-3 px-1 flex items-center gap-2">
              <span className="material-icons-round text-purple-500 text-lg">work_history</span>
              Vai trò phụ
            </h2>
             <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-4 shadow-card border border-purple-100 dark:border-purple-900/30 relative overflow-hidden group">
                {hasServerSecondaryRole && (
                    <Button size="lg" variant="outline" onClick={() => router.push('/shifts')}>
                        <CheckSquare className="mr-2" />
                        Checklist Công việc
                    </Button>
                )}
                {hasBartenderSecondaryRole && (
                    <>
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
                {hasManagerSecondaryRole && (
                    <Button size="lg" variant="outline" onClick={() => router.push('/manager/comprehensive-report')}>
                        <FileSearch className="mr-2" />
                        Phiếu kiểm tra toàn diện
                    </Button>
                )}
                {hasCashierSecondaryRole && (
                    <Button size="lg" variant="outline" onClick={() => router.push('/cashier')}>
                        <Banknote className="mr-2" />
                        Báo cáo Thu ngân
                    </Button>
                )}
             </div>
          </div>
        )}

        {!showCheckInCardOnTop && <CheckInCard />}
      </main>

       <nav className="bg-surface-light dark:bg-surface-dark border-t border-gray-200 dark:border-gray-800 px-6 py-2 pb-5 sm:pb-2 grid grid-cols-4 gap-1 glass-effect absolute bottom-0 w-full z-40">
        <NavItem icon={LayoutDashboard} label="Dash" isActive />
        <NavItem icon={Calendar} label="Lịch" />
        <NavItem icon={MessageSquare} label="Tin nhắn" />
        <NavItem icon={UserIcon} label="Tôi" />
      </nav>
    </div>
  );
}
