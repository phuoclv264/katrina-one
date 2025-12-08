'use client';

import React, { useMemo } from 'react';
import { Banknote, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import type { RevenueStats } from '@/lib/types';
import { useRouter } from 'nextjs-toploader/app';

const paymentMethodLabels: { [key: string]: string } = {
    cash: "Tiền mặt",
    bank_transfer: "Chuyển khoản",
    techcombankVietQrPro: "TCB VietQR Pro",
    shopeeFood: "ShopeeFood",
    grabFood: "GrabFood",
};

export type CashierOverviewCardProps = {
  profit: number;
  totalRevenue: number;
  totalExpense: number;
  revenueByMethod: RevenueStats['revenueByPaymentMethod'];
  expenseByMethod: Record<string, number>;
};

export function CashierOverviewCard({ profit, totalRevenue, totalExpense, revenueByMethod, expenseByMethod }: CashierOverviewCardProps) {
  const router = useRouter();
  const formattedProfit = `${profit.toLocaleString('vi-VN')}đ`;
  const description = `Thu ${totalRevenue.toLocaleString('vi-VN')}đ - Chi ${totalExpense.toLocaleString('vi-VN')}đ`;

  const hasDetails = useMemo(() => {
    const hasRevenueDetails = revenueByMethod && Object.values(revenueByMethod).some(v => v > 0);
    const hasExpenseDetails = expenseByMethod && Object.values(expenseByMethod).some(v => v > 0);
    return hasRevenueDetails || hasExpenseDetails;
  }, [revenueByMethod, expenseByMethod]);

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Card className="flex flex-col h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-lg">
            <Banknote className="status-success" /> Báo cáo Thu ngân
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow">
          <p className={cn(
            "text-4xl font-bold",
            profit > 0 && "status-success",
            profit < 0 && "status-error"
          )}>{formattedProfit}</p>
          {hasDetails && (
            <Accordion type="single" collapsible className="w-full mt-4">
              <AccordionItem value="details" className="border-none">
                <AccordionTrigger className="text-sm p-0 hover:no-underline">Xem chi tiết</AccordionTrigger>
                <AccordionContent className="pt-2 text-sm">
                  <div className="space-y-2">
                    <div>
                      <h4 className="font-semibold status-success">Doanh thu theo PTTT:</h4>
                      {Object.entries(revenueByMethod).filter(([, amount]) => amount > 0).map(([method, amount]) => (
                        <div key={method} className="flex justify-between text-muted-foreground">
                          <span>{paymentMethodLabels[method] || method}</span>
                          <span>{amount.toLocaleString('vi-VN')}đ</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <h4 className="font-semibold status-error">Chi phí theo PTTT:</h4>
                      {Object.entries(expenseByMethod).filter(([, amount]) => amount > 0).map(([method, amount]) => (
                        <div key={method} className="flex justify-between text-muted-foreground">
                          <span>{paymentMethodLabels[method] || method}</span>
                          <span>{amount.toLocaleString('vi-VN')}đ</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </CardContent>
        <CardFooter>
          <Button variant="outline" className="w-full" onClick={() => router.push('/reports/cashier')}>
            Đến trang thu ngân
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}