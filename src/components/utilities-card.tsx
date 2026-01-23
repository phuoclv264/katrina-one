'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { ListChecks } from 'lucide-react';
import { DashboardActionCard } from './dashboard-action-card';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { dataStore } from '@/lib/data-store';
import { getUserAccessLinks } from '@/lib/user-access-links';
import { useCheckInCardPlacement } from '@/hooks/useCheckInCardPlacement';
import type { DailyTask, UserRole } from '@/lib/types';

export default function UtilitiesCard() {
  const { user, isOnActiveShift, activeShifts } = useAuth();
  const { isCheckedIn } = useCheckInCardPlacement();
  const nav = useAppNavigation();
  const [todayTasks, setTodayTasks] = useState<DailyTask[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = dataStore.subscribeToDailyTasksForDate(new Date(), (tasks) => setTodayTasks(tasks));
    return unsub;
  }, [user]);

  const secondaryActions = useMemo(() => {
    if (!user) return [];

    const { secondary } = getUserAccessLinks({
      user,
      isCheckedIn,
      activeShifts: activeShifts || [],
      isOnActiveShift,
    });


    return secondary;
  }, [user, activeShifts, isCheckedIn, isOnActiveShift]);

  const hasPendingDailyAssignment = useMemo(() => {
    if (!user) return false;
    const uid = user.uid;
    const role = user.role as UserRole;
    const todayKey = new Date().toISOString().slice(0, 10);
    return todayTasks.some((t) => {
      if (!t) return false;
      if (t.status === 'completed') return false;
      if (t.assignedDate !== todayKey) return false;
      if (t.targetMode === 'roles') {
        return (t.targetRoles || []).includes(role);
      }
      if (t.targetMode === 'users') {
        return (t.targetUserIds || []).includes(uid);
      }
      return false;
    });
  }, [todayTasks, user]);

  const pendingDailyCount = useMemo(() => {
    if (!user) return 0;
    const uid = user.uid;
    const role = user.role as UserRole;
    const todayKey = new Date().toISOString().slice(0, 10);
    return todayTasks.reduce((count, t) => {
      if (!t) return count;
      if (t.status === 'completed') return count;
      if (t.assignedDate !== todayKey) return count;
      if (t.targetMode === 'roles' && (t.targetRoles || []).includes(role)) return count + 1;
      if (t.targetMode === 'users' && (t.targetUserIds || []).includes(uid)) return count + 1;
      return count;
    }, 0);
  }, [todayTasks, user]);

  const showDailyCardForManager = user?.role === 'Quản lý';
  const hasActions = (secondaryActions?.length ?? 0) > 0 || showDailyCardForManager || hasPendingDailyAssignment;

  if (!user || !hasActions) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tiện ích</h3>
        <span className="text-[10px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full font-bold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Đang hoạt động
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 auto-rows-min items-stretch">
        {(showDailyCardForManager || hasPendingDailyAssignment) && (
          <div className="relative col-span-2">
            <DashboardActionCard
              label={showDailyCardForManager ? 'Giao việc cần làm' : (pendingDailyCount > 1 ? `Bạn có ${pendingDailyCount} công việc` : 'Bạn có công việc mới')}
              subLabel={showDailyCardForManager ? (pendingDailyCount > 0 ? `Có ${pendingDailyCount} nhiệm vụ chờ` : 'Giao và quản lý công việc') : 'Mở danh sách công việc'}
              icon={ListChecks}
              onClick={() => nav.push('/daily-assignments')}
              color={showDailyCardForManager ? 'amber' : 'rose'}
              variant={'primary'}
              className="shadow-lg h-full"
            />
            {pendingDailyCount > 0 && (
              <span className="absolute -top-2 -right-2 z-20 w-6 h-6 rounded-full bg-rose-500 text-white text-[12px] flex items-center justify-center font-bold">{pendingDailyCount}</span>
            )}
          </div>
        )}

        {secondaryActions.filter(a => a.href !== '/daily-assignments').map((action, index) => {
          return (
            <div key={index} className="relative h-full">
              <DashboardActionCard
                label={action.label}
                subLabel={action.subLabel ?? action.roleTag}
                icon={action.icon}
                onClick={() => nav.push(action.href)}
                color={action.color}
                className="h-full"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
