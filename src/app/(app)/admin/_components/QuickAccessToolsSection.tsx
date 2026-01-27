'use client';

import React from 'react';
import { useAppNavigation } from '@/contexts/app-navigation-context';
import { CheckCircle2, Box, DollarSign, History, Calendar, Calculator, Megaphone, ListChecks } from 'lucide-react';

interface QuickAccessToolsSectionProps {
  onNavigate?: (path: string) => void;
}

export function QuickAccessToolsSection({ onNavigate }: QuickAccessToolsSectionProps) {
  const navigation = useAppNavigation();

  const tools = [
    {
      icon: CheckCircle2,
      label: 'Báo cáo công việc định kỳ',
      color: 'blue',
      path: '/monthly-task-reports',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      borderColor: 'border-blue-500',
      hoverColor: 'hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10',
    },
    {
      icon: ListChecks,
      label: 'Giao việc trong ngày',
      color: 'blue',
      path: '/daily-assignments',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      borderColor: 'border-blue-500',
      hoverColor: 'hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10',
    },
    {
      icon: Calendar,
      label: 'Tạo báo cáo tháng',
      color: 'indigo',
      path: 'create-monthly-report',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
      borderColor: 'border-indigo-500',
      hoverColor: 'hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10',
    },
    {
      icon: Calculator,
      label: 'Bảng lương tháng',
      color: 'teal',
      path: 'salary-management',
      bgColor: 'bg-teal-100 dark:bg-teal-900/30',
      iconColor: 'text-teal-600 dark:text-teal-400',
      borderColor: 'border-teal-500',
      hoverColor: 'hover:border-teal-500 dark:hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/10',
    },
    {
      icon: Megaphone,
      label: 'Quản lý Sự kiện',
      color: 'rose',
      path: '/admin/events',
      bgColor: 'bg-rose-100 dark:bg-rose-900/30',
      iconColor: 'text-rose-600 dark:text-rose-400',
      borderColor: 'border-rose-500',
      hoverColor: 'hover:border-rose-500 dark:hover:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10',
    },
    {
      icon: Box,
      label: 'Kho hàng',
      color: 'orange',
      path: '/reports/inventory',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
      iconColor: 'text-orange-600 dark:text-orange-400',
      borderColor: 'border-orange-500',
      hoverColor: 'hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10',
    },
    {
      icon: DollarSign,
      label: 'Thu chi',
      color: 'green',
      path: '/reports/cashier',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      borderColor: 'border-green-500',
      hoverColor: 'hover:border-green-500 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/10',
    },
    {
      icon: History,
      label: 'Lịch sử kho',
      color: 'purple',
      path: '/inventory-history',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
      borderColor: 'border-purple-500',
      hoverColor: 'hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10',
    },
  ];

  const handleClick = (path: string) => {
    if (onNavigate) {
      onNavigate(path);
      return;
    }

    navigation.push(path);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <h3 className="font-bold text-gray-900 dark:text-white mb-4">Truy cập nhanh</h3>
      <div className="grid grid-cols-2 gap-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.path}
              onClick={() => handleClick(tool.path)}
              className={`p-4 rounded-xl border border-gray-100 dark:border-gray-700 ${tool.hoverColor} transition group flex flex-col items-center text-center`}
            >
              <div
                className={`w-12 h-12 rounded-full ${tool.bgColor} ${tool.iconColor} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{tool.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
