
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpCircle, ArrowDownCircle, Wallet, LandPlot, Calendar as CalendarIcon, BarChart, List, Banknote, Loader2 } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { addDays, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO, eachDayOfInterval } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ResponsiveContainer, BarChart as RechartsBarChart, XAxis, YAxis, Tooltip, Legend, Bar, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import type { RevenueStats, ExpenseSlip, ExpenseItem } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function FinancialReportPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  
  const [allRevenueStats, setAllRevenueStats] = useState<RevenueStats[]>([]);
  const [allExpenseSlips, setAllExpenseSlips] = useState<ExpenseSlip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user?.role !== 'Chủ nhà hàng') {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) {
      let revenueLoaded = false;
      let expensesLoaded = false;
      const checkLoadingDone = () => {
        if (revenueLoaded && expensesLoaded) setIsLoading(false);
      }

      const unsubRevenue = dataStore.subscribeToAllRevenueStats(stats => {
        setAllRevenueStats(stats);
        revenueLoaded = true;
        checkLoadingDone();
      });
      const unsubExpenses = dataStore.subscribeToAllExpenseSlips(slips => {
        setAllExpenseSlips(slips);
        expensesLoaded = true;
        checkLoadingDone();
      });

      return () => {
        unsubRevenue();
        unsubExpenses();
      };
    }
  }, [user]);

  const filteredData = useMemo(() => {
    if (!dateRange?.from) return { revenue: [], expenses: [] };
    const from = dateRange.from;
    const to = dateRange.to ?? dateRange.from;

    const filteredRevenue = allRevenueStats.filter(stat => 
      isWithinInterval(parseISO(stat.date), { start: from, end: to })
    );

    const filteredExpenses = allExpenseSlips.filter(slip => 
      isWithinInterval(parseISO(slip.date), { start: from, end: to })
    );
    
    return { revenue: filteredRevenue, expenses: filteredExpenses };
  }, [allRevenueStats, allExpenseSlips, dateRange]);


  const summaryData = useMemo(() => {
    const totalRevenue = filteredData.revenue.reduce((sum, stat) => sum + stat.netRevenue, 0);
    const revenueBreakdown = filteredData.revenue.reduce((acc, stat) => {
        acc.cash += stat.revenueByPaymentMethod.cash || 0;
        acc.techcombankVietQrPro += stat.revenueByPaymentMethod.techcombankVietQrPro || 0;
        acc.shopeeFood += stat.revenueByPaymentMethod.shopeeFood || 0;
        acc.grabFood += stat.revenueByPaymentMethod.grabFood || 0;
        acc.bankTransfer += stat.revenueByPaymentMethod.bankTransfer || 0;
        return acc;
    }, { cash: 0, techcombankVietQrPro: 0, shopeeFood: 0, grabFood: 0, bankTransfer: 0 });

    const totalExpense = filteredData.expenses.reduce((sum, slip) => sum + slip.totalAmount, 0);
    const expenseBreakdown = filteredData.expenses.reduce((acc, slip) => {
        if (slip.paymentMethod === 'cash') acc.cash += slip.totalAmount;
        else acc.bank_transfer += slip.totalAmount;
        return acc;
    }, { cash: 0, bank_transfer: 0 });
    
    const expenseByCategory = filteredData.expenses.flatMap(e => e.items).reduce((acc, item) => {
        const category = item.name.includes("Chi phí sự cố") ? 'Sự cố' : 'Nguyên liệu';
        acc[category] = (acc[category] || 0) + (item.quantity * item.unitPrice);
        return acc;
    }, {} as {[key: string]: number});
    
    return { totalRevenue, revenueBreakdown, totalExpense, expenseBreakdown, expenseByCategory };
  }, [filteredData]);

  const setDatePreset = (preset: 'this_week' | 'this_month') => {
    const today = new Date();
    if (preset === 'this_week') {
      setDateRange({ from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) });
    } else {
      setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
    }
  };
  
    const chartData = useMemo(() => {
        if (!dateRange?.from) return [];
        const from = dateRange.from;
        const to = dateRange.to ?? dateRange.from;
        const days = eachDayOfInterval({start: from, end: to});

        return days.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dailyRevenue = filteredData.revenue
                .filter(stat => stat.date === dateKey)
                .reduce((sum, stat) => sum + stat.netRevenue, 0);
            const dailyExpense = filteredData.expenses
                .filter(slip => slip.date === dateKey)
                .reduce((sum, slip) => sum + slip.totalAmount, 0);

            return {
                name: format(day, 'dd/MM'),
                'Doanh thu': dailyRevenue,
                'Chi phí': dailyExpense
            }
        });
    }, [dateRange, filteredData]);
  
  const expensePieChartData = Object.entries(summaryData.expenseByCategory).map(([name, value]) => ({ name, value }));
  
  const detailedData = useMemo(() => {
      const groupedByDate: {[date: string]: {revenue: RevenueStats[], expenses: ExpenseSlip[]}} = {};
      
      filteredData.revenue.forEach(r => {
          if (!groupedByDate[r.date]) groupedByDate[r.date] = { revenue: [], expenses: [] };
          groupedByDate[r.date].revenue.push(r);
      });
      filteredData.expenses.forEach(e => {
          if (!groupedByDate[e.date]) groupedByDate[e.date] = { revenue: [], expenses: [] };
          groupedByDate[e.date].expenses.push(e);
      });

      return Object.entries(groupedByDate)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredData]);
  
  if (isLoading || authLoading) {
    return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground mt-4">Đang tải dữ liệu tài chính...</p>
        </div>
    )
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
          <Banknote />
          Báo cáo Tài chính
        </h1>
        <p className="text-muted-foreground mt-2">
          Tổng quan về doanh thu, chi phí và lợi nhuận trong khoảng thời gian đã chọn.
        </p>
      </header>

      {/* Date Range Filter */}
      <Card className="mb-8">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-full sm:w-[300px] justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                    </>
                  ) : (
                    format(dateRange.from, "dd/MM/yy")
                  )
                ) : (
                  <span>Chọn ngày</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <div className='flex gap-2'>
            <Button variant="outline" onClick={() => setDatePreset('this_week')}>Tuần này</Button>
            <Button variant="outline" onClick={() => setDatePreset('this_month')}>Tháng này</Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Card className="shadow-lg border-green-200 dark:border-green-800 bg-white dark:bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold text-green-600 dark:text-green-400">TỔNG DOANH THU</CardTitle>
            <ArrowUpCircle className="h-6 w-6 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-extrabold text-green-700 dark:text-green-300">{summaryData.totalRevenue.toLocaleString('vi-VN')}đ</div>
            <Separator className="my-4"/>
            <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Tiền mặt:</span> <span className="font-medium">{summaryData.revenueBreakdown.cash.toLocaleString('vi-VN')}đ</span></div>
                <div className="flex justify-between"><span>Techcombank VietQR:</span> <span className="font-medium">{summaryData.revenueBreakdown.techcombankVietQrPro.toLocaleString('vi-VN')}đ</span></div>
                <div className="flex justify-between"><span>ShopeeFood:</span> <span className="font-medium">{summaryData.revenueBreakdown.shopeeFood.toLocaleString('vi-VN')}đ</span></div>
                <div className="flex justify-between"><span>GrabFood:</span> <span className="font-medium">{summaryData.revenueBreakdown.grabFood.toLocaleString('vi-VN')}đ</span></div>
                <div className="flex justify-between"><span>Chuyển khoản khác:</span> <span className="font-medium">{summaryData.revenueBreakdown.bankTransfer.toLocaleString('vi-VN')}đ</span></div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-lg border-red-200 dark:border-red-800 bg-white dark:bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold text-red-600 dark:text-red-400">TỔNG CHI PHÍ</CardTitle>
            <ArrowDownCircle className="h-6 w-6 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-extrabold text-red-700 dark:text-red-300">{summaryData.totalExpense.toLocaleString('vi-VN')}đ</div>
             <Separator className="my-4"/>
             <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center"><span className="flex items-center gap-2"><Wallet className="text-gray-500"/>Chi tiền mặt:</span> <span className="font-medium">{summaryData.expenseBreakdown.cash.toLocaleString('vi-VN')}đ</span></div>
                <div className="flex justify-between items-center"><span className="flex items-center gap-2"><LandPlot className="text-blue-500"/>Chi chuyển khoản:</span> <span className="font-medium">{summaryData.expenseBreakdown.bank_transfer.toLocaleString('vi-VN')}đ</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart & Details Tabs */}
      <Tabs defaultValue="chart">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chart"><BarChart className="mr-2" />Biểu đồ</TabsTrigger>
          <TabsTrigger value="details"><List className="mr-2" />Chi tiết</TabsTrigger>
        </TabsList>
        <TabsContent value="chart" className="mt-4">
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Xu hướng Doanh thu & Chi phí</CardTitle>
                         <CardDescription>
                            Biểu đồ thể hiện biến động theo từng ngày trong khoảng thời gian đã chọn.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis tickFormatter={(value) => new Intl.NumberFormat('vi-VN', { notation: "compact", compactDisplay: "short" }).format(value as number)} />
                                <Tooltip formatter={(value: number) => `${value.toLocaleString('vi-VN')}đ`}/>
                                <Legend />
                                <Line type="monotone" dataKey="Doanh thu" stroke="#16a34a" strokeWidth={2} activeDot={{ r: 8 }} />
                                <Line type="monotone" dataKey="Chi phí" stroke="#ef4444" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Tỷ trọng chi phí</CardTitle>
                         <CardDescription>
                            Phân tích cấu trúc chi phí theo từng hạng mục.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={expensePieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                    {expensePieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(value: number) => `${value.toLocaleString('vi-VN')}đ`}/>
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>
        <TabsContent value="details" className="mt-4">
          <Accordion type="multiple" defaultValue={detailedData.map(d => d.date)} className="space-y-2">
            {detailedData.map((dayData, index) => {
              const totalDailyRevenue = dayData.revenue.reduce((sum, r) => sum + r.netRevenue, 0);
              const totalDailyExpense = dayData.expenses.reduce((sum, e) => sum + e.totalAmount, 0);

              return (
              <AccordionItem value={dayData.date} key={index} className="bg-white dark:bg-card border rounded-lg">
                <AccordionTrigger className="p-4 text-base font-semibold">
                  <div className="w-full flex justify-between items-center">
                    <span>Ngày {format(new Date(dayData.date), "dd/MM/yyyy")}</span>
                    <div className="flex gap-4 text-sm">
                      <span className="text-green-600">Thu: {totalDailyRevenue.toLocaleString('vi-VN')}đ</span>
                      <span className="text-red-600">Chi: {totalDailyExpense.toLocaleString('vi-VN')}đ</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-4 border-t">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                        <h4 className="font-semibold mb-2 text-green-600">Doanh thu</h4>
                        <Table>
                            <TableBody>
                                {dayData.revenue.length > 0 ? dayData.revenue.map((item, idx) => (
                                    <TableRow key={`rev-${idx}`}>
                                        <TableCell>Doanh thu từ POS</TableCell>
                                        <TableCell className="text-right font-medium text-green-600">{item.netRevenue.toLocaleString('vi-VN')}đ</TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Không có</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-2 text-red-600">Chi phí</h4>
                        <Table>
                            <TableBody>
                                {dayData.expenses.length > 0 ? dayData.expenses.map((item, idx) => (
                                    <TableRow key={`exp-${idx}`}>
                                        <TableCell>
                                            {item.items.map(i => i.shortName).join(', ')}
                                            <Badge variant={item.paymentMethod === 'cash' ? 'secondary' : 'outline'} className="ml-2">{item.paymentMethod === 'cash' ? 'Tiền mặt' : 'CK'}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-red-600">{item.totalAmount.toLocaleString('vi-VN')}đ</TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Không có</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )})}
          </Accordion>
        </TabsContent>
      </Tabs>
    </div>
  );
}
