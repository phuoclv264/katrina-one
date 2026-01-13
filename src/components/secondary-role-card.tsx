'use client';

import React from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Sparkles, Package, Receipt, FileSearch, CheckSquare, Sun, Moon, Sunset, ListChecks } from 'lucide-react';
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
      }
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
      }
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
      {
        label: 'Giao việc cần làm',
        subLabel: 'Quản lý',
        icon: ListChecks,
        href: '/daily-assignments',
        color: 'blue',
      },
    ],
  },
};

export { default } from './utilities-card';

