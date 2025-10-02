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
    <Card className="border-primary">
      <CardHeader><CardTitle>Tổng quan Tháng {format(currentMonth, 'MM/yyyy')}</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="font-semibold text-lg text-green-600">Doanh thu: {monthlySummary.totalRevenue.toLocaleString('vi-VN')}đ</h4>
          <div className="text-sm space-y-1">
            <p className="font-medium">Theo phương thức thanh toán:</p>
            {Object.entries(monthlySummary.revenueByMethod).map(([key, value]) => (<p key={key} className="pl-4">{key}: <span className="font-medium">{value.toLocaleString('vi-VN')}đ</span></p>))}
          </div>
        </div>
        <div className="space-y-4">
          <h4 className="font-semibold text-lg text-red-600">Chi phí: {monthlySummary.totalExpense.toLocaleString('vi-VN')}đ</h4>
          <div className="text-sm space-y-1">
            <p className="font-medium">Theo Phương thức Thanh toán:</p>
            <p className="pl-4">Tiền mặt: <span className="font-medium">{(monthlySummary.expenseByPaymentMethod['cash'] || 0).toLocaleString('vi-VN')}đ</span></p>
            <div className="pl-4 flex items-center gap-2">
              <span>Chuyển khoản: <span className="font-medium">{(monthlySummary.expenseByPaymentMethod['bank_transfer'] || 0).toLocaleString('vi-VN')}đ</span></span>
              {monthlySummary.unpaidBankTransfer > 0 && (
                <div className='flex items-center gap-1'>
                  <Badge variant="destructive">Chưa TT: {monthlySummary.unpaidBankTransfer.toLocaleString('vi-VN')}đ</Badge>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onOpenUnpaidDialog}>Xem chi tiết</Button>
                </div>
              )}
            </div>
            <div className="pl-4 flex items-center gap-2"><span>Chi phí vô hình: <span className="font-medium">{(monthlySummary.intangibleCost || 0).toLocaleString('vi-VN')}đ</span></span></div>
          </div>
          <Separator />
          <div className="text-sm space-y-1">
            <p className="font-medium">Theo Loại chi phí:</p>
            {Object.entries(monthlySummary.expenseByType).map(([key, value]) => (<p key={key} className="pl-4">{key}: <span className="font-medium">{value.toLocaleString('vi-VN')}đ</span></p>))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

MonthlySummary.displayName = 'MonthlySummary';

export default MonthlySummary;
