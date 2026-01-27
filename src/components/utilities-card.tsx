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

  const hasActions = (secondaryActions?.length ?? 0) > 0;

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
