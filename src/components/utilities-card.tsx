'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { ListChecks, Sun, Moon, Sunset, Sparkles, Package, Receipt } from 'lucide-react';
import { DashboardActionCard } from './dashboard-action-card';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { dataStore } from '@/lib/data-store';
import type { DailyTask, UserRole, ManagedUser } from '@/lib/types';

const mainShiftInfo: { [key: string]: { name: string; icon: React.ElementType; href: string } } = {
  sang: { name: 'Báo cáo ca sáng', icon: Sun, href: '/checklist/sang' },
  trua: { name: 'Báo cáo ca trưa', icon: Sunset, href: '/checklist/trua' },
  toi: { name: 'Báo cáo ca tối', icon: Moon, href: '/checklist/toi' },
};

export default function UtilitiesCard() {
  const { user } = useAuth();
  const nav = useAppNavigation();
  const [todayTasks, setTodayTasks] = useState<DailyTask[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = dataStore.subscribeToDailyTasksForDate(new Date(), (tasks) => setTodayTasks(tasks));
    return unsub;
  }, [user]);

  const activeMainShiftKeys = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const keys = new Set<'sang' | 'trua' | 'toi'>();

    const timeFrames = {
      sang: { start: 6, end: 12 },
      trua: { start: 12, end: 17 },
      toi: { start: 17, end: 23 },
    };

    for (const key in timeFrames) {
      const shiftKey = key as 'sang' | 'trua' | 'toi';
      const frame = timeFrames[shiftKey];
      const validStartTime = frame.start - 1;
      const validEndTime = frame.end + 1;
      if (currentHour >= validStartTime && currentHour < validEndTime) {
        keys.add(shiftKey);
      }
    }

    return Array.from(keys);
  }, []);

  const secondaryActions = useMemo(() => {
    if (!user) return [] as any[];

    const actions: any[] = [];

    // Add active main shift actions for secondary 'Phục vụ'
    if (user.secondaryRoles?.includes('Phục vụ') && activeMainShiftKeys.length > 0) {
      activeMainShiftKeys.forEach((key) => {
        const info = mainShiftInfo[key];
        actions.push({ label: info.name, subLabel: 'Phục vụ', icon: info.icon, href: info.href, color: 'blue' as const });
      });
    }

    // (Daily assignments handled separately below; only show when there are pending items.)
    // Managers can still access the Giao việc screen via navigation if needed.

    // Add role-specific utilities (existing behavior)
    // Pha chế
    if (user.secondaryRoles?.includes('Pha chế')) {
      actions.push({ label: 'Vệ sinh quầy', subLabel: 'Pha chế', icon: Sparkles, href: '/bartender/hygiene-report', color: 'emerald' as const });
      actions.push({ label: 'Kiểm kê kho', subLabel: 'Pha chế', icon: Package, href: '/bartender/inventory', color: 'purple' as const });
    }

    // Thu ngân
    if (user.secondaryRoles?.includes('Thu ngân')) {
      actions.push({ label: 'Báo cáo thu ngân', subLabel: 'Thu ngân', icon: Receipt, href: '/cashier', color: 'blue' as const });
    }

    return actions;
  }, [user, activeMainShiftKeys]);

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

  const showDailyCardForManager = user?.role === 'Quản lý' || user?.role === 'Chủ nhà hàng';

  if (!user || (!user.secondaryRoles || user.secondaryRoles.length === 0) && !showDailyCardForManager) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tiện ích</h3>
        <span className="text-[10px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full font-bold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Đang hoạt động
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 auto-rows-fr">
        {(showDailyCardForManager || hasPendingDailyAssignment) && (
          <div className="relative col-span-2">
            <DashboardActionCard
              label={showDailyCardForManager ? 'Giao việc cần làm' : (pendingDailyCount > 1 ? `Bạn có ${pendingDailyCount} công việc` : 'Bạn có công việc mới')}
              subLabel={showDailyCardForManager ? (pendingDailyCount > 0 ? `Có ${pendingDailyCount} nhiệm vụ chờ` : 'Giao và quản lý công việc') : 'Mở danh sách công việc'}
              icon={ListChecks}
              onClick={() => nav.push('/daily-assignments')}
              color={showDailyCardForManager ? 'amber' : 'rose'}
              variant={'primary'}
              className={showDailyCardForManager ? 'shadow-lg' : 'shadow-lg'}
            />
            {pendingDailyCount > 0 && (
              <span className="absolute -top-2 -right-2 z-20 w-6 h-6 rounded-full bg-rose-500 text-white text-[12px] flex items-center justify-center font-bold">{pendingDailyCount}</span>
            )}
          </div>
        )}

        {secondaryActions.filter(a => a.href !== '/daily-assignments').map((action, index) => {
          return (
            <div key={index} className="relative">
              <DashboardActionCard
                label={action.label}
                subLabel={action.subLabel}
                icon={action.icon}
                onClick={() => nav.push(action.href)}
                color={action.color}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
