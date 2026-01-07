'use client';

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Sparkles, Package, Receipt, FileSearch, CheckSquare, Sun, Moon, Sunset } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/types';
import { useMemo } from 'react';
import { DashboardActionCard } from './dashboard-action-card';
import { useAppNavigation } from '@/contexts/app-navigation-context';

interface RoleAction {
  label: string;
  subLabel: string;
  icon: React.ElementType;
  href: string;
  color: 'emerald' | 'purple' | 'blue' | 'orange';
}

interface RoleConfig {
  label: string;
  actions: RoleAction[];
}

const mainShiftInfo: { [key: string]: { name: string; icon: React.ElementType; href: string } } = {
  sang: { name: 'Báo cáo ca sáng', icon: Sun, href: '/checklist/sang' },
  trua: { name: 'Báo cáo ca trưa', icon: Sunset, href: '/checklist/trua' },
  toi: { name: 'Báo cáo ca tối', icon: Moon, href: '/checklist/toi' },
};

const mainShiftTimeFrames: { [key in 'sang' | 'trua' | 'toi']: { start: number; end: number } } = {
  sang: { start: 6, end: 12 }, // 6:00 AM - 12:00 PM
  trua: { start: 12, end: 17 }, // 12:00 PM - 5:00 PM
  toi: { start: 17, end: 23 }, // 5:00 PM - 11:00 PM
};

const ROLE_CONFIGS: Partial<Record<UserRole, RoleConfig>> = {
  'Pha chế': {
    label: 'Pha chế',
    actions: [
      {
        label: 'Vệ sinh quầy',
        subLabel: 'Pha chế',
        icon: Sparkles,
        href: '/bartender/hygiene-report',
        color: 'emerald',
      },
      {
        label: 'Kiểm kê kho',
        subLabel: 'Pha chế',
        icon: Package,
        href: '/bartender/inventory',
        color: 'purple',
      },
    ],
  },
  'Thu ngân': {
    label: 'Thu ngân',
    actions: [
      {
        label: 'Báo cáo thu ngân',
        subLabel: 'Thu ngân',
        icon: Receipt,
        href: '/cashier',
        color: 'blue',
      },
    ],
  },
  'Quản lý': {
    label: 'Quản lý',
    actions: [
      {
        label: 'Phiếu kiểm tra toàn diện',
        subLabel: 'Quản lý',
        icon: FileSearch,
        href: '/manager/comprehensive-report',
        color: 'orange',
      },
    ],
  },
};

export default function SecondaryRoleCard() {
  const { user } = useAuth();
  const nav = useAppNavigation();

  const activeMainShiftKeys = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const keys = new Set<'sang' | 'trua' | 'toi'>();

    for (const key in mainShiftTimeFrames) {
      const shiftKey = key as 'sang' | 'trua' | 'toi';
      const frame = mainShiftTimeFrames[shiftKey];

      const validStartTime = frame.start - 1;
      const validEndTime = frame.end + 1;

      if (currentHour >= validStartTime && currentHour < validEndTime) {
        keys.add(shiftKey);
      }
    }

    return Array.from(keys);
  }, []);

  if (!user || !user.secondaryRoles || user.secondaryRoles.length === 0) return null;

  // Filter secondary roles that have configurations and collect all actions
  const secondaryActions = user.secondaryRoles.flatMap((role) => {
    if (role === 'Phục vụ') {
      if (activeMainShiftKeys.length > 0) {
        return activeMainShiftKeys.map((key) => {
          const info = mainShiftInfo[key];
          return {
            label: info.name,
            subLabel: 'Phục vụ',
            icon: info.icon,
            href: info.href,
            color: 'blue' as const,
          };
        });
      }
    }
    return ROLE_CONFIGS[role]?.actions || [];
  });

  if (secondaryActions.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Vai trò phụ
        </h3>
        <span className="text-[10px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full font-bold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Đang hoạt động
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {secondaryActions.map((action, index) => (
          <DashboardActionCard
            key={index}
            label={action.label}
            subLabel={action.subLabel}
            icon={action.icon}
            onClick={() => {
              nav.push(action.href);
            }}
            color={action.color}
          />
        ))}
      </div>
    </div>
  );
}
