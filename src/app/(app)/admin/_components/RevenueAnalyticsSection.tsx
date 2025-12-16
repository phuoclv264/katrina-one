'use client';

import React from 'react';
import { PieChart, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RevenueStats } from '@/lib/types';

interface RevenueAnalyticsSectionProps {
  revenueByMethod: RevenueStats['revenueByPaymentMethod'];
  totalRevenue: number;
  onRefresh?: () => void;
  onExport?: () => void;
}

const paymentMethodLabels: { [key: string]: { label: string; color: string; bgColor: string } } = {
  techcombankVietQrPro: { label: 'TCB VietQR Pro', color: 'bg-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-900/10' },
  cash: { label: 'Tiền mặt', color: 'bg-green-500', bgColor: 'bg-green-50 dark:bg-green-900/10' },
  shopeeFood: { label: 'ShopeeFood', color: 'bg-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/10' },
  grabFood: { label: 'GrabFood', color: 'bg-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-900/10' },
  bank_transfer: { label: 'Chuyển khoản', color: 'bg-indigo-500', bgColor: 'bg-indigo-50 dark:bg-indigo-900/10' },
};

export function RevenueAnalyticsSection({
  revenueByMethod,
  totalRevenue,
  onRefresh,
  onExport,
}: RevenueAnalyticsSectionProps) {
  const methodEntries = Object.entries(revenueByMethod)
    .filter(([, amount]) => amount > 0)
    .map(([method, amount]) => {
      const percentage = totalRevenue > 0 ? ((amount / totalRevenue) * 100).toFixed(0) : '0';
      return {
        method,
        amount,
        percentage: parseInt(percentage),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const total = methodEntries.reduce((sum, entry) => sum + entry.percentage, 0);
  const remainingPercentage = Math.max(0, 100 - total);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <PieChart className="text-blue-500 h-5 w-5" />
            Phân tích nguồn thu
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Chi tiết doanh thu theo phương thức thanh toán</p>
        </div>
        <div className="flex gap-2">
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport} className="gap-2">
              <Download className="h-4 w-4" /> Xuất CSV
            </Button>
          )}
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Đồng bộ
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
        {/* Pie Chart */}
        <div className="flex flex-col items-center justify-center relative min-h-[200px]">
          <div className="relative w-40 h-40">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path className="text-gray-100 dark:text-gray-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="6"></path>

              {methodEntries.map((entry, index) => {
                const offset = methodEntries.slice(0, index).reduce((sum, e) => sum + e.percentage, 0);
                return (
                  <path
                    key={entry.method}
                    className={paymentMethodLabels[entry.method]?.color || 'text-gray-400'}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray={`${entry.percentage}, 100`}
                    strokeDashoffset={`-${offset}`}
                    strokeWidth="6"
                  ></path>
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-gray-400">Tổng</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">100%</span>
            </div>
          </div>
        </div>

        {/* Revenue Breakdown */}
        <div className="lg:col-span-2 space-y-4">
          {methodEntries.map((entry) => {
            const methodInfo = paymentMethodLabels[entry.method];
            if (!methodInfo) return null;

            return (
              <div key={entry.method} className="group">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-300 font-medium">{methodInfo.label}</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {entry.amount.toLocaleString('vi-VN')}đ{' '}
                    <span className="text-gray-400 font-normal ml-1">({entry.percentage}%)</span>
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className={`${methodInfo.color} h-2 rounded-full transition-all duration-300`}
                    style={{ width: `${entry.percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700 flex gap-3">
        <Button variant="outline" className="flex-1">
          Xuất CSV
        </Button>
        <Button className="flex-1 bg-blue-600 hover:bg-blue-700 gap-2">
          <RefreshCw className="h-4 w-4" /> Đồng bộ dữ liệu
        </Button>
      </div>
    </div>
  );
}
