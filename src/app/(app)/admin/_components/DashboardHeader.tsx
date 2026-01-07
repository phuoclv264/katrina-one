'use client';

import React, { useState } from 'react';
import { MessageSquareWarning } from 'lucide-react';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { Button } from '@/components/ui/button';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { vi } from 'date-fns/locale';

interface DashboardHeaderProps {
  userName?: string;
  userRole?: string;
  complaintsCount?: number;
}

type DateFilter = 'today' | 'yesterday' | 'week';

type DashboardHeaderPropsEx = DashboardHeaderProps & {
  selectedDateFilter?: DateFilter;
  onDateFilterChange?: (filter: DateFilter) => void;
};

export function DashboardHeader({ userName = 'Admin User', userRole = 'Chủ cửa hàng', complaintsCount = 0, selectedDateFilter, onDateFilterChange }: DashboardHeaderPropsEx) {
  const [localFilter, setLocalFilter] = useState<DateFilter>(selectedDateFilter ?? 'today');
  const navigation = useAppNavigation();
  const now = new Date();
  const dateText = format(now, 'EEEE, dd MMMM yyyy', { locale: vi });
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'dd MMM');
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'dd MMM yyyy');
  const weekRangeText = `${weekStart} - ${weekEnd}`;

  // keep internal state in sync if parent controls the filter
  React.useEffect(() => {
    if (selectedDateFilter) setLocalFilter(selectedDateFilter);
  }, [selectedDateFilter]);

  return (
  <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 md:sticky md:top-0 md:z-30">
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Left side: Greeting */}
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Bảng điều khiển</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Chào mừng trở lại, <span className="font-semibold">{userName}</span>!
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{localFilter === 'week' ? `Tuần: ${weekRangeText}` : dateText}</p>
            {localFilter === 'week' ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Dữ liệu: {weekStart} - {weekEnd}</p>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Dữ liệu: {localFilter === 'yesterday' ? 'Hôm qua' : 'Hôm nay'}</p>
            )}
          </div>

          {/* Right side: Filters and Notifications */}
          <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto">
            {/* Date filter buttons: desktop */}
            <div className="hidden md:flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-1">
              <Button
              variant={localFilter === 'today' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3 text-xs font-medium"
              onClick={() => {
                setLocalFilter('today');
                onDateFilterChange?.('today');
              }}
              >
              Hôm nay
              </Button>
              <Button
              variant={localFilter === 'yesterday' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3 text-xs font-medium"
              onClick={() => {
                setLocalFilter('yesterday');
                onDateFilterChange?.('yesterday');
              }}
              >
              Hôm qua
              </Button>
              <Button
              variant={localFilter === 'week' ? 'default' : 'ghost'}
              size="sm"
              className="h-8 px-3 text-xs font-medium"
              onClick={() => {
                setLocalFilter('week');
                onDateFilterChange?.('week');
              }}
              >
              Tuần này
              </Button>
            </div>

            {/* Mobile: dropdown */}
            <div className="md:hidden min-w-[140px]">
              <label htmlFor="dashboard-date-filter" className="sr-only">
              Chọn bộ lọc ngày
              </label>
              <div className="relative">
              <select
                id="dashboard-date-filter"
                value={localFilter}
                onChange={(e) => {
                const v = e.target.value as DateFilter;
                setLocalFilter(v);
                onDateFilterChange?.(v);
                }}
                className="block w-full bg-gray-100 dark:bg-gray-700 rounded-lg h-8 pl-3 pr-8 text-sm font-medium text-gray-900 dark:text-white"
                aria-label="Chọn bộ lọc ngày"
              >
                {(['today', 'yesterday', 'week'] as DateFilter[]).map((v) =>
                  React.createElement(
                    'option',
                    { key: v, value: v },
                    v === 'today' ? 'Hôm nay' : v === 'yesterday' ? 'Hôm qua' : 'Tuần này'
                  )
                )}
              </select>

              {/* chevron icon */}
              <svg
                className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
              </div>
            </div>

            {/* Notifications */}
            <button
                onClick={() => navigation.push('/reports-feed')}
              aria-label="Xem tố cáo"
              className="relative p-2 text-orange-500 hover:text-orange-600 transition rounded-lg hover:bg-orange-50 dark:hover:bg-orange-800"
            >
              <MessageSquareWarning className="h-5 w-5" />
              {complaintsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] font-semibold">
                  {complaintsCount > 99 ? '99+' : complaintsCount}
                </span>
              )}
            </button>

            {/* User profile */}
            <div className="flex items-center gap-3 pl-3 sm:border-l border-gray-200 dark:border-gray-700">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{userName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{userRole}</div>
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-white dark:ring-gray-700 cursor-pointer">
                {userName.charAt(0)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
