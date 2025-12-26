'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { RevenueStats, ExpenseSlip, IncidentReport, ExpenseItem } from '@/lib/types';
import { isSameMonth, parseISO, format } from 'date-fns';

type MonthlySummaryProps = {
  currentMonth: Date;
  revenueStats: RevenueStats[];
  expenseSlips: ExpenseSlip[];
  incidents: IncidentReport[];
  onOpenUnpaidDialog: () => void;
};

const getSlipContentName = (item: ExpenseItem): string => {
    if (item.itemId === 'other_cost') {
      if (item.name === 'Khác' && item.description) {
          return `${item.name} (${item.description})`;
      }
      return item.name;
  }
  return item.name;
}

const MonthlySummary = React.memo(({ currentMonth, revenueStats, expenseSlips, incidents, onOpenUnpaidDialog }: MonthlySummaryProps) => {

  const monthlyBankTransferSlips = useMemo(() => expenseSlips.filter(slip => isSameMonth(parseISO(slip.date), currentMonth) && slip.paymentMethod === 'bank_transfer'), [expenseSlips, currentMonth]);
  const monthlyIntangibleIncidents = useMemo(() => incidents.filter(i => isSameMonth(parseISO(i.date), currentMonth) && i.paymentMethod === 'intangible_cost' && i.cost > 0), [incidents, currentMonth]);
  
  const monthlySummary = useMemo(() => {
    // Group revenue stats by date to find the latest for each day
    const latestDailyStats: { [date: string]: RevenueStats } = {};
    revenueStats.forEach(stat => {
        if (!latestDailyStats[stat.date] || new Date(stat.createdAt as string) > new Date(latestDailyStats[stat.date].createdAt as string)) {
            latestDailyStats[stat.date] = stat;
        }
    });
    const dailyRevenueArray = Object.values(latestDailyStats);

    const totalRevenue = dailyRevenueArray.reduce((sum, stat) => sum + stat.netRevenue, 0);

    const totalExpense = expenseSlips.reduce((sum, slip) => sum + slip.totalAmount, 0);

    const revenueByMethod = dailyRevenueArray.reduce((acc, stat) => {
        if (stat.revenueByPaymentMethod) Object.keys(stat.revenueByPaymentMethod).forEach(key => { acc[key] = (acc[key] || 0) + stat.revenueByPaymentMethod[key as keyof typeof stat.revenueByPaymentMethod]; });
        return acc;
    }, {} as {[key: string]: number});

    const expenseByPaymentMethod = expenseSlips.reduce((acc, slip) => { acc[slip.paymentMethod] = (acc[slip.paymentMethod] || 0) + slip.totalAmount; return acc; }, {} as {[key: string]: number});
    const unpaidBankTransfer = monthlyBankTransferSlips.filter(s => s.paymentStatus !== 'paid').reduce((sum, slip) => {
      if (slip.expenseType === 'other_cost') {
          return sum + slip.totalAmount;
      }
      const unpaidAmount = slip.items.filter(item => !item.isPaid).reduce((itemSum, item) => itemSum + (item.quantity * item.unitPrice), 0);
      return sum + unpaidAmount;
    }, 0);
    const intangibleCost = monthlyIntangibleIncidents.reduce((sum, i) => sum + i.cost, 0);
    
    const expenseByType = expenseSlips.reduce((acc, slip) => {
        const type = slip.expenseType === 'goods_import' ? 'Nhập hàng' : (getSlipContentName(slip.items[0]) || 'Khác');
        acc[type] = (acc[type] || 0) + slip.totalAmount;
        return acc;
    }, {} as {[key: string]: number});
    
    return { totalRevenue, totalExpense, revenueByMethod, expenseByType, expenseByPaymentMethod, intangibleCost, unpaidBankTransfer };
  }, [revenueStats, expenseSlips, monthlyBankTransferSlips, monthlyIntangibleIncidents]);

  return (
    <Card className="border-primary/50 shadow-sm overflow-hidden">
      <CardHeader className="bg-primary/5 p-3 sm:p-4">
        <CardTitle className="text-lg sm:text-xl">Tổng quan Tháng {format(currentMonth, 'MM/yyyy')}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 p-3 sm:p-6">
        <div className="space-y-3 p-3 rounded-lg bg-green-50/50 dark:bg-green-950/10 border border-green-100 dark:border-green-900/30">
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400">Tổng Doanh thu</span>
            <h4 className="font-bold text-xl sm:text-2xl text-green-700 dark:text-green-300">{monthlySummary.totalRevenue.toLocaleString('vi-VN')}đ</h4>
          </div>
          <div className="text-xs sm:text-sm space-y-1.5">
            <p className="font-semibold text-muted-foreground">Theo phương thức:</p>
            <div className="grid grid-cols-1 gap-1">
              {Object.entries(monthlySummary.revenueByMethod).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center pl-2 border-l-2 border-green-200 dark:border-green-800">
                  <span className="text-muted-foreground">{key}</span>
                  <span className="font-bold">{value.toLocaleString('vi-VN')}đ</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 p-3 rounded-lg bg-red-50/50 dark:bg-red-950/10 border border-red-100 dark:border-red-900/30">
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Tổng Chi phí</span>
            <h4 className="font-bold text-xl sm:text-2xl text-red-700 dark:text-red-300">{monthlySummary.totalExpense.toLocaleString('vi-VN')}đ</h4>
          </div>
          <div className="text-xs sm:text-sm space-y-1.5">
            <p className="font-semibold text-muted-foreground">Theo phương thức:</p>
            <div className="grid grid-cols-1 gap-1">
              <div className="flex justify-between items-center pl-2 border-l-2 border-red-200 dark:border-red-800">
                <span className="text-muted-foreground">Tiền mặt</span>
                <span className="font-bold">{(monthlySummary.expenseByPaymentMethod['cash'] || 0).toLocaleString('vi-VN')}đ</span>
              </div>
              <div className="flex justify-between items-center pl-2 border-l-2 border-red-200 dark:border-red-800">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Chuyển khoản</span>
                  {monthlySummary.unpaidBankTransfer > 0 && (
                    <button onClick={onOpenUnpaidDialog} className="hover:opacity-80 transition-opacity">
                      <Badge variant="destructive" className="h-4 px-1 text-[10px]">Nợ</Badge>
                    </button>
                  )}
                </div>
                <span className="font-bold">{(monthlySummary.expenseByPaymentMethod['bank_transfer'] || 0).toLocaleString('vi-VN')}đ</span>
              </div>
              {monthlySummary.intangibleCost > 0 && (
                <div className="flex justify-between items-center pl-2 border-l-2 border-red-200 dark:border-red-800">
                  <span className="text-muted-foreground">Vô hình</span>
                  <span className="font-bold">{(monthlySummary.intangibleCost || 0).toLocaleString('vi-VN')}đ</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="sm:col-span-2">
          <Separator className="my-2" />
          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Phân bổ chi phí</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(monthlySummary.expenseByType).map(([key, value]) => (
                <div key={key} className="bg-muted/50 px-3 py-1.5 rounded-full flex items-center gap-2 border border-border/50">
                  <span className="text-xs font-medium">{key}</span>
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">{value.toLocaleString('vi-VN')}đ</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

MonthlySummary.displayName = 'MonthlySummary';

export default MonthlySummary;
