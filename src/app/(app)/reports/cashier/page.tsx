'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { toast } from 'react-hot-toast';
import OwnerCashierDialogs from './_components/owner-cashier-dialogs';


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
    inventoryList: any[],
  }>({ revenueStats: [], expenseSlips: [], incidents: [], inventoryList: [] });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Dialog states
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);
  const [slipToEdit, setSlipToEdit] = useState<ExpenseSlip | null>(null);
  const [revenueStatsToEdit, setRevenueStatsToEdit] = useState<RevenueStats | null>(null);


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
     const unsubInventory = dataStore.subscribeToInventoryList(items => {
        setAllData(prev => ({...prev, inventoryList: items}));
    });

    const timer = setTimeout(() => setIsLoading(false), 1500);

    return () => {
      unsubExpense();
      unsubIncidents();
      unsubRevenue();
      unsubInventory();
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
    
    for(const date in grouped) {
        grouped[date].expenses?.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
        grouped[date].incidents?.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
    }

    return grouped;
  }, [allData]);

  const sortedDates = useMemo(() => Object.keys(groupedReports).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()), [groupedReports]);

  // --- Handlers for dialogs ---
  const handleEditExpense = (slip: ExpenseSlip) => {
      setSlipToEdit(slip);
      setIsExpenseDialogOpen(true);
  }

  const handleEditRevenue = (stats: RevenueStats) => {
      setRevenueStatsToEdit(stats);
      setIsRevenueDialogOpen(true);
  }

  const handleSaveSlip = useCallback(async (data: any, id?: string) => {
    if (!user) return;
    setIsProcessing(true);
    try {
        const slipData = { ...data, createdBy: { userId: user.uid, userName: user.displayName }};
        await dataStore.addOrUpdateExpenseSlip(slipData, id);
        toast.success(`Đã cập nhật phiếu chi.`);
        setIsExpenseDialogOpen(false);
    } catch (error) {
        console.error("Failed to save expense slip", error);
        toast.error("Không thể lưu phiếu chi.");
    } finally {
        setIsProcessing(false);
    }
  }, [user]);

  const handleSaveRevenue = useCallback(async (data: Omit<RevenueStats, 'id' | 'date' | 'createdAt' | 'createdBy' | 'isEdited'>, isEdited: boolean) => {
    if(!user || !revenueStatsToEdit) return;
    setIsProcessing(true);
    try {
        await dataStore.addOrUpdateRevenueStats(data, user, isEdited, revenueStatsToEdit.id);
        toast.success("Đã cập nhật doanh thu.");
        setIsRevenueDialogOpen(false);
    } catch(error) {
        console.error("Failed to save revenue stats", error);
        toast.error("Không thể lưu doanh thu.");
    } finally {
        setIsProcessing(false);
    }
  }, [user, revenueStatsToEdit]);


  if (isLoading || authLoading) {
    return (
      <div className="container mx-auto max-w-4xl p-4 sm:p-6 md:p-8">
        <header className="mb-8"><Skeleton className="h-10 w-1/2" /></header>
        <Card><CardContent className="p-6"><Skeleton className="h-96 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <>
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
                           
                            {dayReports.revenue ? (
                                <Card>
                                    <CardHeader className="flex-row items-center justify-between">
                                        <div>
                                            <CardTitle className="text-base flex items-center gap-2"><Receipt /> Thống kê Doanh thu</CardTitle>
                                            <CardDescription>Cập nhật bởi {dayReports.revenue.createdBy.userName} lúc {format(new Date(dayReports.revenue.createdAt as string), 'HH:mm')}</CardDescription>
                                        </div>
                                        <Button size="sm" onClick={() => handleEditRevenue(dayReports.revenue!)}>
                                            Chi tiết <ArrowRight className="ml-2 h-4 w-4"/>
                                        </Button>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-lg font-bold">Doanh thu Net: {dayReports.revenue.netRevenue.toLocaleString('vi-VN')}đ</p>
                                    </CardContent>
                                </Card>
                            ) : (
                                <p className="text-sm text-muted-foreground">Không có báo cáo doanh thu trong ngày.</p>
                            )}
                            
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
                                                    <TableHead className="text-right">Hành động</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {dayReports.expenses.map(expense => (
                                                    <TableRow key={expense.id}>
                                                        <TableCell>
                                                          {expense.items.map(i => i.name).join(', ')}
                                                          <p className="text-xs text-muted-foreground">{expense.createdBy.userName}</p>
                                                        </TableCell>
                                                        <TableCell>{expense.totalAmount.toLocaleString('vi-VN')}đ</TableCell>
                                                        <TableCell className="text-right">
                                                          <Button variant="outline" size="sm" onClick={() => handleEditExpense(expense)}>Chi tiết</Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            )}

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
    <OwnerCashierDialogs
        inventoryList={allData.inventoryList}
        // Expense Slip Dialog props
        isExpenseDialogOpen={isExpenseDialogOpen}
        setIsExpenseDialogOpen={setIsExpenseDialogOpen}
        handleSaveSlip={handleSaveSlip}
        isProcessing={isProcessing}
        slipToEdit={slipToEdit}
        // Revenue Stats Dialog props
        isRevenueDialogOpen={isRevenueDialogOpen}
        setIsRevenueDialogOpen={setIsRevenueDialogOpen}
        handleSaveRevenue={handleSaveRevenue}
        revenueStatsToEdit={revenueStatsToEdit}
    />
    </>
  );
}
