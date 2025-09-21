
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { dataStore } from '@/lib/data-store';
import type { ExpenseSlip, IncidentReport, RevenueStats, InventoryItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Banknote, Receipt, AlertTriangle, ArrowRight, DollarSign, Wallet, FileWarning, Calendar, LandPlot } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isSameMonth, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import OwnerCashierDialogs from './_components/owner-cashier-dialogs';
import { toast } from 'react-hot-toast';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';


type GroupedReports = {
  [date: string]: {
    revenue?: RevenueStats;
    expenses?: ExpenseSlip[];
    incidents?: IncidentReport[];
  };
};

const ExpenseList = ({ expenses, onEdit }: { expenses: ExpenseSlip[], onEdit: (slip: ExpenseSlip) => void }) => {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Thời gian</TableHead>
            <TableHead>Nội dung</TableHead>
            <TableHead>Số tiền</TableHead>
            <TableHead>Phương thức</TableHead>
            <TableHead className="text-right">Hành động</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map(expense => (
            <TableRow key={expense.id}>
              <TableCell className="text-sm text-muted-foreground">{format(new Date(expense.createdAt as string), 'HH:mm')}</TableCell>
              <TableCell>
                {expense.items.map(i => i.name).join(', ')}
                <p className="text-xs text-muted-foreground">{expense.createdBy.userName}</p>
              </TableCell>
              <TableCell>{expense.totalAmount.toLocaleString('vi-VN')}đ</TableCell>
              <TableCell className="text-sm">
                 <Badge variant={expense.paymentMethod === 'cash' ? 'secondary' : 'outline'}>
                    {expense.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                 </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={() => onEdit(expense)}>Chi tiết</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  // Mobile View
  return (
    <div className="space-y-3">
      {expenses.map((expense, index) => (
        <React.Fragment key={expense.id}>
          <div className="p-3">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-medium text-sm pr-2">{expense.items.map(i => i.name).join(', ')}</p>
                    <p className="text-xs text-muted-foreground">bởi {expense.createdBy.userName}</p>
                </div>
                <div className="text-right">
                    <p className="font-bold text-base">{expense.totalAmount.toLocaleString('vi-VN')}đ</p>
                </div>
            </div>
            <div className="flex justify-between items-center mt-2 text-xs">
                <div className="flex items-center gap-2">
                    <Badge variant={expense.paymentMethod === 'cash' ? 'secondary' : 'outline'} className="text-xs">
                        {expense.paymentMethod === 'cash' ? <Wallet className="mr-1 h-3 w-3"/> : <LandPlot className="mr-1 h-3 w-3"/>}
                        {expense.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                    </Badge>
                    <span className="text-muted-foreground">{format(new Date(expense.createdAt as string), 'HH:mm')}</span>
                </div>
                <Button variant="link" size="sm" onClick={() => onEdit(expense)} className="h-auto p-0">
                    Xem chi tiết
                </Button>
            </div>
          </div>
          {index < expenses.length - 1 && <Separator />}
        </React.Fragment>
      ))}
    </div>
  );
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
  
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isRevenueDialogOpen, setIsRevenueDialogOpen] = useState(false);
  const [slipToEdit, setSlipToEdit] = useState<ExpenseSlip | null>(null);
  const [revenueStatsToEdit, setRevenueStatsToEdit] = useState<RevenueStats | null>(null);

  const [currentDate, setCurrentDate] = useState(new Date());


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

    const { monthlyTotals, groupedReports } = useMemo(() => {
    const startOfCurrentMonth = startOfMonth(currentDate);
    const endOfCurrentMonth = endOfMonth(currentDate);

    const filteredRevenue = allData.revenueStats.filter(stat => isSameMonth(parseISO(stat.date), startOfCurrentMonth));
    const filteredExpenses = allData.expenseSlips.filter(slip => isSameMonth(parseISO(slip.date), startOfCurrentMonth));
    const filteredIncidents = allData.incidents.filter(incident => isSameMonth(parseISO(incident.date), startOfCurrentMonth));

    const monthlyTotalRevenue = filteredRevenue.reduce((sum, stat) => sum + stat.netRevenue, 0);
    const monthlyTotalExpense = filteredExpenses.reduce((sum, slip) => sum + slip.totalAmount, 0);
    const monthlyTotalIncidents = filteredIncidents.length;

    const grouped: GroupedReports = {};
    const combined = [...allData.revenueStats, ...allData.expenseSlips, ...allData.incidents];
    
    combined.forEach(item => {
      const date = item.date;
      if (!grouped[date]) grouped[date] = {};

      if('netRevenue' in item) grouped[date].revenue = item;
      else if ('items' in item) {
          if (!grouped[date].expenses) grouped[date].expenses = [];
          grouped[date].expenses.push(item);
      } else if ('content' in item) {
          if (!grouped[date].incidents) grouped[date].incidents = [];
          grouped[date].incidents.push(item);
      }
    });

    for(const date in grouped) {
        grouped[date].expenses?.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
        grouped[date].incidents?.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
    }

    return { 
        monthlyTotals: {
            revenue: monthlyTotalRevenue,
            expense: monthlyTotalExpense,
            incidents: monthlyTotalIncidents,
        },
        groupedReports: grouped
    };
  }, [allData, currentDate]);

  const sortedDates = useMemo(() => Object.keys(groupedReports).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()), [groupedReports]);

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
      <div className="container mx-auto p-4 sm:p-6 md:p-8">
        <header className="mb-8"><Skeleton className="h-10 w-1/2" /></header>
        <Card><CardContent className="p-6"><Skeleton className="h-96 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <>
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
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

       <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
             <Calendar className="h-5 w-5" />
             Tổng quan Tháng {format(currentDate, 'MM/yyyy')}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="bg-green-500/10 border-green-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-800 dark:text-green-300">Tổng Doanh thu</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700 dark:text-green-200">{monthlyTotals.revenue.toLocaleString('vi-VN')}đ</div>
            </CardContent>
          </Card>
           <Card className="bg-blue-500/10 border-blue-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-300">Tổng Chi</CardTitle>
              <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-200">{monthlyTotals.expense.toLocaleString('vi-VN')}đ</div>
            </CardContent>
          </Card>
           <Card className="bg-amber-500/10 border-amber-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-800 dark:text-amber-300">Tổng Sự cố</CardTitle>
              <FileWarning className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-200">{monthlyTotals.incidents}</div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>


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
                    <AccordionItem value={date} key={date} className="border-none">
                        <AccordionTrigger className="p-4 text-lg font-medium hover:no-underline rounded-lg bg-white dark:bg-card border-l-4 border-primary shadow-sm data-[state=open]:rounded-b-none transition-all hover:bg-muted/80">
                            <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <Calendar className="h-5 w-5" />
                                </div>
                                <span className="text-lg font-semibold">{format(parseISO(date), 'eeee, dd/MM/yyyy', { locale: vi })}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border border-t-0 rounded-b-lg shadow-sm bg-muted/30">
                           
                            <div className="md:col-span-2">
                                {dayReports.revenue ? (
                                    <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                                        <CardHeader className="flex-row items-center justify-between p-4">
                                            <div>
                                                <CardTitle className="text-base flex items-center gap-2 text-green-800 dark:text-green-300"><Receipt /> Doanh thu trong ngày</CardTitle>
                                                <CardDescription className="text-green-700 dark:text-green-400/80">Cập nhật bởi {dayReports.revenue.createdBy.userName} lúc {format(new Date(dayReports.revenue.createdAt as string), 'HH:mm')}</CardDescription>
                                            </div>
                                            <Button size="sm" onClick={() => handleEditRevenue(dayReports.revenue!)}>
                                                Chi tiết <ArrowRight className="ml-2 h-4 w-4"/>
                                            </Button>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0">
                                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{dayReports.revenue.netRevenue.toLocaleString('vi-VN')}đ</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">Không có báo cáo doanh thu trong ngày.</p>
                                )}
                            </div>
                            
                            <div className="md:col-span-2">
                                {dayReports.expenses && dayReports.expenses.length > 0 ? (
                                    <Card>
                                        <CardHeader className="p-4">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300">
                                                  <Wallet/>
                                                </div>
                                                Phiếu chi ({dayReports.expenses.length})
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <ExpenseList expenses={dayReports.expenses} onEdit={handleEditExpense} />
                                        </CardContent>
                                    </Card>
                                ) : (
                                  <Card className="h-full">
                                    <CardContent className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm p-4">
                                        <p>Không có phiếu chi nào được tạo.</p>
                                    </CardContent>
                                  </Card>
                                )}
                            </div>

                             <div className="md:col-span-2">
                                {dayReports.incidents && dayReports.incidents.length > 0 ? (
                                    <Card>
                                        <CardHeader className="p-4">
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300">
                                                  <AlertTriangle/>
                                                </div>
                                                Sự cố ({dayReports.incidents.length})
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-0 space-y-3">
                                        {dayReports.incidents.map(incident => (
                                            <Card key={incident.id} className="border-amber-500/30 bg-amber-500/10">
                                                <CardContent className="p-3">
                                                    <p className="font-semibold text-amber-900 dark:text-amber-200">{incident.content}</p>
                                                    <p className="text-sm text-amber-800 dark:text-amber-300/80">
                                                    Chi phí: {incident.cost.toLocaleString('vi-VN')}đ (bởi {incident.createdBy.userName})
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        ))}
                                        </CardContent>
                                    </Card>
                                ) : (
                                  <Card className="h-full">
                                    <CardContent className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm p-4">
                                        <p>Không có sự cố nào được ghi nhận.</p>
                                    </CardContent>
                                  </Card>
                                )}
                            </div>

                        </AccordionContent>
                    </AccordionItem>
                )
            })}
          </Accordion>
      )}
    </div>
    <OwnerCashierDialogs
        inventoryList={allData.inventoryList}
        isExpenseDialogOpen={isExpenseDialogOpen}
        setIsExpenseDialogOpen={setIsExpenseDialogOpen}
        handleSaveSlip={handleSaveSlip}
        isProcessing={isProcessing}
        slipToEdit={slipToEdit}
        isRevenueDialogOpen={isRevenueDialogOpen}
        setIsRevenueDialogOpen={setIsRevenueDialogOpen}
        handleSaveRevenue={handleSaveRevenue}
        revenueStatsToEdit={revenueStatsToEdit}
    />
    </>
  );
}
