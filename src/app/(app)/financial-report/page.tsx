
'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpCircle, ArrowDownCircle, Wallet, LandPlot, Calendar as CalendarIcon, BarChart, List, Banknote, Loader2, ArrowRight } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { addDays, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO, eachDayOfInterval, subWeeks, subMonths, getDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ResponsiveContainer, BarChart as RechartsBarChart, XAxis, YAxis, Tooltip, Legend, Bar, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, AreaChart, Area, ComposedChart } from 'recharts';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { dataStore } from '@/lib/data-store';
import type { RevenueStats, ExpenseSlip, ExpenseItem } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';


const PAYMENT_METHOD_COLORS = {
    cash: '#22c55e', // green-500
    techcombankVietQrPro: '#3b82f6', // blue-500
    shopeeFood: '#f97316', // orange-500
    grabFood: '#10b981', // emerald-500
    bankTransfer: '#8b5cf6', // violet-500
};

const REVENUE_CHANNEL_COLORS = {
    'Tại quán': '#3b82f6', // blue-500
    'ShopeeFood': '#f97316', // orange-500
    'GrabFood': '#10b981', // emerald-500
};

const PAYMENT_METHOD_NAMES: { [key: string]: string } = {
    cash: 'Tiền mặt',
    techcombankVietQrPro: 'TCB VietQR',
    shopeeFood: 'ShopeeFood',
    grabFood: 'GrabFood',
    bankTransfer: 'Chuyển khoản',
};

const getWeekDays = (locale: Locale) => {
    const format = (date: Date) => date.toLocaleDateString(locale.code, { weekday: 'short' });
    const days: string[] = [];
    for (let i = 1; i <= 7; i++) { // Start from Monday
        days.push(format(new Date(2023, 0, 1 + i)));
    }
    return days;
};

const weekDays = getWeekDays(vi);

const calculateChange = (current: number, previous: number) => {
    if (previous === 0) {
        return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
};

const ChangeIndicator = ({ value }: { value: number }) => {
    if (isNaN(value) || !isFinite(value)) return null;

    const isPositive = value > 0;
    const isNegative = value < 0;

    return (
        <span className={cn(
            "text-xs font-semibold flex items-center",
            isPositive && "text-green-600",
            isNegative && "text-red-600"
        )}>
            {isPositive ? '▲' : '▼'} {Math.abs(value).toFixed(1)}%
        </span>
    );
};


export default function FinancialReportPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const [compare, setCompare] = useState(false);
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
      setIsLoading(true);
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

  const filterDataByRange = useCallback((range: DateRange | undefined) => {
    if (!range?.from) return { revenue: [], expenses: [] };
    const from = range.from;
    const to = range.to ?? range.from;

    const filteredRevenue = allRevenueStats.filter(stat => 
      isWithinInterval(parseISO(stat.date), { start: from, end: to })
    );

    const filteredExpenses = allExpenseSlips.filter(slip => 
      isWithinInterval(parseISO(slip.date), { start: from, end: to })
    );
    
    return { revenue: filteredRevenue, expenses: filteredExpenses };
  }, [allRevenueStats, allExpenseSlips]);

  const mainPeriodData = useMemo(() => filterDataByRange(dateRange), [dateRange, filterDataByRange]);

  const comparisonPeriod = useMemo(() => {
    if (!compare || !dateRange?.from || !dateRange?.to) return undefined;
    const diff = dateRange.to.getTime() - dateRange.from.getTime();
    const from = new Date(dateRange.from.getTime() - diff - (1000 * 60 * 60 * 24)); // Subtract one more day to make it the previous period
    const to = new Date(dateRange.to.getTime() - diff - (1000 * 60 * 60 * 24));
    return { from, to };
  }, [dateRange, compare]);

  const comparisonPeriodData = useMemo(() => filterDataByRange(comparisonPeriod), [comparisonPeriod, filterDataByRange]);
  
  const calculateSummary = (data: { revenue: RevenueStats[], expenses: ExpenseSlip[] }) => {
    const totalRevenue = data.revenue.reduce((sum, stat) => sum + stat.netRevenue, 0);
    const revenueBreakdown = data.revenue.reduce((acc, stat) => {
        acc.cash += stat.revenueByPaymentMethod.cash || 0;
        acc.techcombankVietQrPro += stat.revenueByPaymentMethod.techcombankVietQrPro || 0;
        acc.shopeeFood += stat.revenueByPaymentMethod.shopeeFood || 0;
        acc.grabFood += stat.revenueByPaymentMethod.grabFood || 0;
        acc.bankTransfer += stat.revenueByPaymentMethod.bankTransfer || 0;
        return acc;
    }, { cash: 0, techcombankVietQrPro: 0, shopeeFood: 0, grabFood: 0, bankTransfer: 0 });

    const totalExpense = data.expenses.reduce((sum, slip) => sum + slip.totalAmount, 0);
    
    const expenseByCategory = data.expenses.flatMap(e => e.items).reduce((acc, item) => {
        const category = item.name.includes("Chi phí sự cố") ? 'Sự cố' : 'Nguyên liệu';
        acc[category] = (acc[category] || 0) + (item.quantity * item.unitPrice);
        return acc;
    }, {} as {[key: string]: number});
    
    const totalProfit = totalRevenue - totalExpense;
    const totalSlips = data.expenses.length;

    return { totalRevenue, revenueBreakdown, totalExpense, expenseByCategory, totalProfit, totalSlips };
  };

  const mainSummary = useMemo(() => calculateSummary(mainPeriodData), [mainPeriodData]);
  const comparisonSummary = useMemo(() => calculateSummary(comparisonPeriodData), [comparisonPeriodData]);


  const setDatePreset = (preset: string) => {
    const today = new Date();
    let from, to;
    switch (preset) {
        case 'this_week':
            from = startOfWeek(today, { weekStartsOn: 1 });
            to = endOfWeek(today, { weekStartsOn: 1 });
            break;
        case 'last_week':
            from = startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
            to = endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 });
            break;
        case 'this_month':
            from = startOfMonth(today);
            to = endOfMonth(today);
            break;
        case 'last_month':
            from = startOfMonth(subMonths(today, 1));
            to = endOfMonth(subMonths(today, 1));
            break;
        default:
            return;
    }
    setDateRange({ from, to });
  };
  
    const chartData = useMemo(() => {
        if (!dateRange?.from) return [];
        
        const getComparisonKey = (date: Date) => {
            const from = dateRange.from!;
            const to = dateRange.to ?? from;
            const diff = to.getTime() - from.getTime();
            const oneWeek = 6 * 24 * 60 * 60 * 1000;
            
            if (diff <= oneWeek) {
                return format(date, 'eeee', { locale: vi });
            }
            return format(date, 'd');
        }

        const dataMap = new Map<string, any>();

        const processPeriodData = (periodData: typeof mainPeriodData, keyPrefix: 'main_' | 'comp_') => {
            periodData.revenue.forEach(stat => {
                const key = getComparisonKey(parseISO(stat.date));
                if (!dataMap.has(key)) dataMap.set(key, { name: key, fullDate: parseISO(stat.date) });
                const entry = dataMap.get(key);
                
                entry[`${keyPrefix}revenue`] = (entry[`${keyPrefix}revenue`] || 0) + stat.netRevenue;
                
                const atStore = (stat.revenueByPaymentMethod.cash || 0) + (stat.revenueByPaymentMethod.techcombankVietQrPro || 0) + (stat.revenueByPaymentMethod.bankTransfer || 0);
                entry[`${keyPrefix}at_store`] = (entry[`${keyPrefix}at_store`] || 0) + atStore;
                entry[`${keyPrefix}shopeefood`] = (entry[`${keyPrefix}shopeefood`] || 0) + (stat.revenueByPaymentMethod.shopeeFood || 0);
                entry[`${keyPrefix}grabfood`] = (entry[`${keyPrefix}grabfood`] || 0) + (stat.revenueByPaymentMethod.grabFood || 0);
            });

            periodData.expenses.forEach(slip => {
                const key = getComparisonKey(parseISO(slip.date));
                if (!dataMap.has(key)) dataMap.set(key, { name: key, fullDate: parseISO(slip.date) });
                const entry = dataMap.get(key);
                entry[`${keyPrefix}expense`] = (entry[`${keyPrefix}expense`] || 0) + slip.totalAmount;
            });
        };

        processPeriodData(mainPeriodData, 'main_');
        if (compare) {
            processPeriodData(comparisonPeriodData, 'comp_');
        }
        
        const sortedData = Array.from(dataMap.values());
        const from = dateRange.from!;
        const to = dateRange.to ?? from;
        const diff = to.getTime() - from.getTime();
        const oneWeek = 6 * 24 * 60 * 60 * 1000;

        if (diff <= oneWeek) {
            sortedData.sort((a,b) => getDay(a.fullDate) - getDay(b.fullDate));
        } else {
            sortedData.sort((a,b) => parseInt(a.name) - parseInt(b.name));
        }

        return sortedData;
    }, [dateRange, mainPeriodData, comparisonPeriodData, compare]);

  const expensePieChartData = Object.entries(mainSummary.expenseByCategory).map(([name, value]) => ({ name, value }));
  
  const detailedData = useMemo(() => {
      const groupedByDate: {[date: string]: {revenue: RevenueStats[], expenses: ExpenseSlip[]}} = {};
      
      mainPeriodData.revenue.forEach(r => {
          if (!groupedByDate[r.date]) groupedByDate[r.date] = { revenue: [], expenses: [] };
          groupedByDate[r.date].revenue.push(r);
      });
      mainPeriodData.expenses.forEach(e => {
          if (!groupedByDate[e.date]) groupedByDate[e.date] = { revenue: [], expenses: [] };
          groupedByDate[e.date].expenses.push(e);
      });

      return Object.entries(groupedByDate)
        .map(([date, data]) => ({ date, ...data }))
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [mainPeriodData]);
  
  const formatTooltipLabel = (label: string, payload: any[]) => {
    if (!payload || payload.length === 0 || !payload[0].payload.fullDate) return label;
    const fullDate = payload[0].payload.fullDate;
    return format(fullDate, 'eeee, dd/MM', { locale: vi });
  }
  
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
        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-4">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full md:w-auto">
             <Select onValueChange={setDatePreset}>
                <SelectTrigger>
                    <SelectValue placeholder="Chọn nhanh..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="this_week">Tuần này</SelectItem>
                    <SelectItem value="last_week">Tuần trước</SelectItem>
                    <SelectItem value="this_month">Tháng này</SelectItem>
                    <SelectItem value="last_month">Tháng trước</SelectItem>
                </SelectContent>
             </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal col-span-2",
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
           </div>
           <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
              <Switch id="compare-switch" checked={compare} onCheckedChange={setCompare} />
              <Label htmlFor="compare-switch">So sánh với kỳ trước</Label>
            </div>
            {compare && comparisonPeriod && (
                <div className="text-sm text-muted-foreground">
                    Kỳ so sánh: {format(comparisonPeriod.from, 'dd/MM/yy')} - {format(comparisonPeriod.to, 'dd/MM/yy')}
                </div>
            )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {/* Revenue Card */}
        <Card className="shadow-lg border-green-200 dark:border-green-800 bg-white dark:bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold text-green-600 dark:text-green-400">TỔNG DOANH THU</CardTitle>
            <ArrowUpCircle className="h-6 w-6 text-green-500" />
          </CardHeader>
          <CardContent className="grid grid-cols-1">
             <div className={cn("transition-all duration-300", compare && "grid grid-cols-2 divide-x")}>
                <div className="p-2">
                    {compare && <p className="text-xs text-muted-foreground">Kỳ này</p>}
                    <div className="text-3xl font-extrabold text-green-700 dark:text-green-300">{mainSummary.totalRevenue.toLocaleString('vi-VN')}đ</div>
                </div>
                {compare && (
                    <div className="p-2 pl-4">
                        <p className="text-xs text-muted-foreground">Kỳ trước</p>
                        <div className="text-3xl font-extrabold text-green-700/70 dark:text-green-300/70">{comparisonSummary.totalRevenue.toLocaleString('vi-VN')}đ</div>
                         <ChangeIndicator value={calculateChange(mainSummary.totalRevenue, comparisonSummary.totalRevenue)} />
                    </div>
                )}
             </div>
            <Separator className="my-4"/>
            <div className="space-y-2 text-sm">
                {Object.entries(mainSummary.revenueBreakdown).map(([key, value]) => {
                  const comparisonValue = compare ? comparisonSummary.revenueBreakdown[key as keyof typeof comparisonSummary.revenueBreakdown] : undefined;
                  return (
                    <div key={key} className="flex justify-between items-center">
                        <span>{PAYMENT_METHOD_NAMES[key]}:</span>
                        <div className="flex items-center gap-2">
                            {compare && <span className="font-medium text-muted-foreground text-xs">({(comparisonValue || 0).toLocaleString('vi-VN')}đ)</span>}
                            <span className="font-medium">{value.toLocaleString('vi-VN')}đ</span>
                        </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
        {/* Expense Card */}
        <Card className="shadow-lg border-red-200 dark:border-red-800 bg-white dark:bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold text-red-600 dark:text-red-400">TỔNG CHI PHÍ</CardTitle>
            <ArrowDownCircle className="h-6 w-6 text-red-500" />
          </CardHeader>
          <CardContent>
             <div className={cn("transition-all duration-300", compare && "grid grid-cols-2 divide-x")}>
                 <div className="p-2">
                    {compare && <p className="text-xs text-muted-foreground">Kỳ này</p>}
                    <div className="text-3xl font-extrabold text-red-700 dark:text-red-300">{mainSummary.totalExpense.toLocaleString('vi-VN')}đ</div>
                </div>
                 {compare && (
                    <div className="p-2 pl-4">
                         <p className="text-xs text-muted-foreground">Kỳ trước</p>
                        <div className="text-3xl font-extrabold text-red-700/70 dark:text-red-300/70">{comparisonSummary.totalExpense.toLocaleString('vi-VN')}đ</div>
                        <ChangeIndicator value={calculateChange(mainSummary.totalExpense, comparisonSummary.totalExpense)} />
                    </div>
                )}
            </div>
             <Separator className="my-4"/>
             <div className="space-y-2 text-sm">
                {Object.entries(mainSummary.expenseByCategory).map(([key, value]) => {
                  const comparisonValue = compare ? comparisonSummary.expenseByCategory[key] : undefined;
                  return(
                    <div className="flex justify-between items-center" key={key}>
                      <span className="flex items-center gap-2">{key}:</span> 
                      <div className="flex items-center gap-2">
                         {compare && <span className="font-medium text-muted-foreground text-xs">({(comparisonValue || 0).toLocaleString('vi-VN')}đ)</span>}
                         <span className="font-medium">{value.toLocaleString('vi-VN')}đ</span>
                      </div>
                    </div>
                  )
                })}
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
            <div className="grid gap-6 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Xu hướng Doanh thu & Chi phí</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis tickFormatter={(value) => new Intl.NumberFormat('vi-VN', { notation: "compact", compactDisplay: "short" }).format(value as number)} />
                                <Tooltip formatter={(value: number) => `${value.toLocaleString('vi-VN')}đ`} labelFormatter={formatTooltipLabel} />
                                <Legend />
                                <Bar dataKey="main_revenue" name="Doanh thu" fill="#16a34a" barSize={20} />
                                <Line type="monotone" dataKey="main_expense" name="Chi phí" stroke="#ef4444" strokeWidth={2} />
                                {compare && <Line type="monotone" dataKey="comp_revenue" name="DT kỳ trước" stroke="#16a34a" strokeWidth={2} strokeDasharray="5 5" />}
                                {compare && <Line type="monotone" dataKey="comp_expense" name="CP kỳ trước" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" />}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Xu hướng Doanh thu theo Kênh</CardTitle>
                    </CardHeader>
                    <CardContent>
                         <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis tickFormatter={(value) => new Intl.NumberFormat('vi-VN', { notation: "compact", compactDisplay: "short" }).format(value as number)} />
                                <Tooltip formatter={(value: number) => `${value.toLocaleString('vi-VN')}đ`} labelFormatter={formatTooltipLabel} />
                                <Legend />
                                <Line type="monotone" dataKey="main_at_store" name="Tại quán" stroke={REVENUE_CHANNEL_COLORS['Tại quán']} strokeWidth={2} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="main_shopeefood" name="ShopeeFood" stroke={REVENUE_CHANNEL_COLORS['ShopeeFood']} strokeWidth={2} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="main_grabfood" name="GrabFood" stroke={REVENUE_CHANNEL_COLORS['GrabFood']} strokeWidth={2} activeDot={{ r: 6 }} />
                                {compare && <Line type="monotone" dataKey="comp_at_store" name="Tại quán (kỳ trước)" stroke={REVENUE_CHANNEL_COLORS['Tại quán']} strokeWidth={2} strokeDasharray="5 5" />}
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                 <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Tỷ trọng chi phí</CardTitle>
                    </CardHeader>
                    <CardContent>
                       <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={expensePieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                    {expensePieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={cn(index === 0 ? "hsl(var(--chart-1))" : "hsl(var(--chart-2))")} />)}
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
