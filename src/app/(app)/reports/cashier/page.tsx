
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
import type { ExpenseSlip, IncidentReport, RevenueStats } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Banknote, Receipt, AlertTriangle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

type ReportItem = (ExpenseSlip | IncidentReport | RevenueStats) & { type: 'expense' | 'incident' | 'revenue' };

type GroupedReports = {
  [date: string]: {
    revenue?: RevenueStats;
    expenses?: ExpenseSlip[];
    incidents?: IncidentReport[];
  };
};

export default function CashierReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [allData, setAllData] = useState<{
    revenueStats: RevenueStats[];
    expenseSlips: ExpenseSlip[];
    incidents: IncidentReport[];
  }>({ revenueStats: [], expenseSlips: [], incidents: [] });
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user?.role !== 'Chủ nhà hàng') {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    
    setIsLoading(true);

    const unsubExpense = dataStore.subscribeToAllExpenseSlips(slips => {
        setAllData(prev => ({...prev, expenseSlips: slips}));
    });
    const unsubIncidents = dataStore.subscribeToAllIncidents(incidents => {
        setAllData(prev => ({...prev, incidents: incidents}));
    });
    const unsubRevenue = dataStore.subscribeToAllRevenueStats(stats => {
        setAllData(prev => ({...prev, revenueStats: stats}));
    });

    // Use a timeout to signal end of loading, as we might not know when all snapshots are initially delivered
    const timer = setTimeout(() => setIsLoading(false), 1500);

    return () => {
      unsubExpense();
      unsubIncidents();
      unsubRevenue();
      clearTimeout(timer);
    };
  }, [user]);

  const groupedReports: GroupedReports = useMemo(() => {
    const grouped: GroupedReports = {};

    allData.revenueStats.forEach(item => {
      const date = item.date;
      if (!grouped[date]) grouped[date] = {};
      grouped[date].revenue = item;
    });

    allData.expenseSlips.forEach(item => {
      const date = item.date;
      if (!grouped[date]) grouped[date] = {};
      if (!grouped[date].expenses) grouped[date].expenses = [];
      grouped[date].expenses.push(item);
    });

    allData.incidents.forEach(item => {
      const date = item.date;
      if (!grouped[date]) grouped[date] = {};
      if (!grouped[date].incidents) grouped[date].incidents = [];
      grouped[date].incidents.push(item);
    });
    
    // Sort expenses and incidents within each day
    for(const date in grouped) {
        grouped[date].expenses?.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
        grouped[date].incidents?.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
    }

    return grouped;
  }, [allData]);

  const sortedDates = useMemo(() => Object.keys(groupedReports).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()), [groupedReports]);

  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
        <header className="mb-8"><Skeleton className="h-10 w-1/2" /></header>
        <Card><CardContent className="p-6"><Skeleton className="h-96 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <Button asChild variant="ghost" className="-ml-4 mb-4">
          <Link href="/reports">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại
          </Link>
        </Button>
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Banknote /> Báo cáo Thu ngân</h1>
        <p className="text-muted-foreground mt-2">
          Tổng hợp toàn bộ báo cáo doanh thu, phiếu chi và sự cố do thu ngân gửi.
        </p>
      </header>

      {sortedDates.length === 0 ? (
          <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                  Chưa có báo cáo nào được gửi.
              </CardContent>
          </Card>
      ) : (
          <Accordion type="multiple" defaultValue={sortedDates.slice(0, 1)} className="space-y-4">
            {sortedDates.map(date => {
                const dayReports = groupedReports[date];
                return (
                    <AccordionItem value={date} key={date} className="border rounded-lg">
                        <AccordionTrigger className="p-4 text-lg font-medium hover:no-underline">
                           Ngày {new Date(date).toLocaleDateString('vi-VN')}
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 p-4 border-t">
                           
                            {/* Revenue Stats */}
                            {dayReports.revenue ? (
                                <Card>
                                    <CardHeader className="flex-row items-center justify-between">
                                        <div>
                                            <CardTitle className="text-base flex items-center gap-2"><Receipt /> Thống kê Doanh thu</CardTitle>
                                            <CardDescription>Cập nhật bởi {dayReports.revenue.createdBy.userName} lúc {format(new Date(dayReports.revenue.createdAt as string), 'HH:mm')}</CardDescription>
                                        </div>
                                        <Button asChild size="sm">
                                            <Link href={`/reports/cashier/details?id=${dayReports.revenue.id}`}>
                                                Chi tiết <ArrowRight className="ml-2 h-4 w-4"/>
                                            </Link>
                                        </Button>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-lg font-bold">Doanh thu Net: {dayReports.revenue.netRevenue.toLocaleString('vi-VN')}đ</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <p className="text-sm text-muted-foreground">Không có báo cáo doanh thu trong ngày.</p>
                            )}
                            
                            {/* Expense Slips */}
                            {dayReports.expenses && dayReports.expenses.length > 0 && (
                                <Card>
                                     <CardHeader>
                                        <CardTitle className="text-base">Phiếu chi ({dayReports.expenses.length})</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Nội dung</TableHead>
                                                    <TableHead>Số tiền</TableHead>
                                                    <TableHead>Người tạo</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {dayReports.expenses.map(expense => (
                                                    <TableRow key={expense.id}>
                                                        <TableCell>{expense.items.map(i => i.name).join(', ')}</TableCell>
                                                        <TableCell>{expense.totalAmount.toLocaleString('vi-VN')}đ</TableCell>
                                                        <TableCell>{expense.createdBy.userName}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            )}

                             {/* Incident Reports */}
                            {dayReports.incidents && dayReports.incidents.length > 0 && (
                                <Card>
                                     <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2"><AlertTriangle/>Sự cố ({dayReports.incidents.length})</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="list-disc pl-5 space-y-2 text-sm">
                                            {dayReports.incidents.map(incident => (
                                                <li key={incident.id}>
                                                    {incident.content}
                                                    <span className="text-muted-foreground"> - Chi phí: {incident.cost.toLocaleString('vi-VN')}đ (bởi {incident.createdBy.userName})</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </CardContent>
                                </Card>
                            )}

                        </AccordionContent>
                    </AccordionItem>
                )
            })}
          </Accordion>
      )}
    </div>
  );
}
