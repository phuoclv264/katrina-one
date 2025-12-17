'use client';

import React from 'react';
import { PieChart, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { RevenueStats } from '@/lib/types';

interface RevenueAnalyticsSectionProps {
  revenueByMethod: RevenueStats['revenueByPaymentMethod'];
  totalRevenue: number;
}

const paymentMethodLabels: { [key: string]: { label: string; color: string; bgColor: string; hex?: string } } = {
  techcombankVietQrPro: { label: 'TCB VietQR Pro', color: 'bg-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-900/10', hex: '#F97316' },
  cash: { label: 'Tiền mặt', color: 'bg-green-500', bgColor: 'bg-green-50 dark:bg-green-900/10', hex: '#10B981' },
  shopeeFood: { label: 'ShopeeFood', color: 'bg-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/10', hex: '#3B82F6' },
  grabFood: { label: 'GrabFood', color: 'bg-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-900/10', hex: '#C084FC' },
  // Support both old ('bank_transfer') and canonical ('bankTransfer') keys for compatibility
  bankTransfer: { label: 'Chuyển khoản', color: 'bg-indigo-500', bgColor: 'bg-indigo-50 dark:bg-indigo-900/10', hex: '#6366F1' },
  bank_transfer: { label: 'Chuyển khoản', color: 'bg-indigo-500', bgColor: 'bg-indigo-50 dark:bg-indigo-900/10', hex: '#6366F1' },
};

export function RevenueAnalyticsSection({
  revenueByMethod,
  totalRevenue,
}: RevenueAnalyticsSectionProps) {
  const methodEntries = Object.entries(revenueByMethod)
    .filter(([, amount]) => amount > 0)
    .map(([method, amount]) => {
      const percentage = totalRevenue > 0 ? parseFloat(((amount / totalRevenue) * 100).toFixed(1)) : 0;
      return {
        method,
        amount,
        percentage,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const total = methodEntries.reduce((sum, entry) => sum + entry.percentage, 0);
  const remainingPercentage = Math.max(0, Math.round((100 - total) * 10) / 10);

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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
        {/* Pie Chart */}
        <div className="flex flex-col items-center justify-center relative min-h-[200px]">
          {/* add padding so thick strokes don't get clipped by container edges */}
          <div className="relative w-40 h-40">
            <svg className="w-full h-full transform -rotate-90 overflow-visible" viewBox="0 0 36 36" role="img" aria-hidden>
              <path className="text-gray-100 dark:text-gray-700" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="6"></path>

              {methodEntries.map((entry, index) => {
                const offset = methodEntries.slice(0, index).reduce((sum, e) => sum + e.percentage, 0);
                const methodInfo = paymentMethodLabels[entry.method] || {};
                return (
                  <path
                    key={entry.method}
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={methodInfo.hex || '#9CA3AF'}
                    strokeDasharray={`${entry.percentage}, 100`}
                    strokeDashoffset={`-${offset}`}
                    strokeWidth="6"
                    strokeLinecap="round"
                  ></path>
                );
              })}
              {remainingPercentage > 0 && (
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#E5E7EB"
                  strokeDasharray={`${remainingPercentage}, 100`}
                  strokeDashoffset={`-${methodEntries.reduce((sum, e) => sum + e.percentage, 0)}`}
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-gray-400">Tổng doanh thu</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white">{totalRevenue.toLocaleString('vi-VN')}đ</span>
              <span className="text-xs text-gray-400 mt-1">{total.toFixed(1)}%</span>
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
    </div>
  );
}
