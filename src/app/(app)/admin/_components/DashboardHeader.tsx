'use client';

import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface DashboardHeaderProps {
  userName?: string;
  userRole?: string;
  complaintsCount?: number;
}

export function DashboardHeader({ userName = 'Admin User', userRole = 'Chủ cửa hàng', complaintsCount = 0 }: DashboardHeaderProps) {
  const [dateFilter, setDateFilter] = useState('today');
  const now = new Date();
  const dateText = format(now, 'EEEE, dd MMMM yyyy', { locale: vi });

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          {/* Left side: Greeting */}
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Bảng điều khiển</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Chào mừng trở lại, <span className="font-semibold">{userName}</span>!
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{dateText}</p>
          </div>

          {/* Right side: Filters and Notifications */}
          <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto">
            {/* Date filter buttons */}
            <div className="hidden md:flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 gap-1">
              <Button
                variant={dateFilter === 'today' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3 text-xs font-medium"
                onClick={() => setDateFilter('today')}
              >
                Hôm nay
              </Button>
              <Button
                variant={dateFilter === 'yesterday' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3 text-xs font-medium"
                onClick={() => setDateFilter('yesterday')}
              >
                Hôm qua
              </Button>
              <Button
                variant={dateFilter === 'week' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 px-3 text-xs font-medium"
                onClick={() => setDateFilter('week')}
              >
                Tuần này
              </Button>
            </div>

            {/* Notifications */}
            <button className="relative p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              <Bell className="h-5 w-5" />
              {complaintsCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-gray-800"></span>
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
