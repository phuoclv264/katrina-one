
'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpCircle, ArrowDownCircle, Wallet, LandPlot, Calendar as CalendarIcon, BarChart, List, Banknote } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { addDays, format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ResponsiveContainer, BarChart as RechartsBarChart, XAxis, YAxis, Tooltip, Legend, Bar, PieChart, Pie, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

// Mock data - replace with actual data fetching logic
const MOCK_REVENUE_DATA = {
  total: 7850000,
  breakdown: {
    cash: 3200000,
    techcombankVietQrPro: 2500000,
    shopeeFood: 1150000,
    grabFood: 750000,
    bankTransfer: 250000,
  }
};

const MOCK_EXPENSE_DATA = {
  total: 2350000,
  breakdown: {
    cash: 1500000,
    bank_transfer: 850000,
  },
  byCategory: {
    'Nguyên liệu': 1800000,
    'Vận hành': 350000,
    'Sự cố': 200000,
  }
};

const MOCK_DETAILED_DATA = [
    {
        date: "2023-10-26",
        revenue: { total: 1200000, items: [{name: 'Doanh thu POS', amount: 1200000}] },
        expenses: [
            { id: '1', name: 'Nhập sữa tươi', amount: 350000, method: 'cash'},
            { id: '2', name: 'Trả tiền điện', amount: 500000, method: 'bank_transfer'},
        ]
    },
    {
        date: "2023-10-25",
        revenue: { total: 950000, items: [{name: 'Doanh thu POS', amount: 950000}] },
        expenses: [
            { id: '3', name: 'Nhập syrup', amount: 600000, method: 'cash'},
        ]
    }
]

const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function FinancialReportPage() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const setDatePreset = (preset: 'this_week' | 'this_month') => {
    const today = new Date();
    if (preset === 'this_week') {
      setDateRange({ from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) });
    } else {
      setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
    }
  };
  
  const chartData = Object.entries(MOCK_EXPENSE_DATA.byCategory).map(([name, value]) => ({ name, 'Chi phí': value }));

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
            <div className="text-4xl font-extrabold text-green-700 dark:text-green-300">{MOCK_REVENUE_DATA.total.toLocaleString('vi-VN')}đ</div>
            <Separator className="my-4"/>
            <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Tiền mặt:</span> <span className="font-medium">{MOCK_REVENUE_DATA.breakdown.cash.toLocaleString('vi-VN')}đ</span></div>
                <div className="flex justify-between"><span>Techcombank VietQR:</span> <span className="font-medium">{MOCK_REVENUE_DATA.breakdown.techcombankVietQrPro.toLocaleString('vi-VN')}đ</span></div>
                <div className="flex justify-between"><span>ShopeeFood:</span> <span className="font-medium">{MOCK_REVENUE_DATA.breakdown.shopeeFood.toLocaleString('vi-VN')}đ</span></div>
                <div className="flex justify-between"><span>GrabFood:</span> <span className="font-medium">{MOCK_REVENUE_DATA.breakdown.grabFood.toLocaleString('vi-VN')}đ</span></div>
                <div className="flex justify-between"><span>Chuyển khoản khác:</span> <span className="font-medium">{MOCK_REVENUE_DATA.breakdown.bankTransfer.toLocaleString('vi-VN')}đ</span></div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-lg border-red-200 dark:border-red-800 bg-white dark:bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-bold text-red-600 dark:text-red-400">TỔNG CHI PHÍ</CardTitle>
            <ArrowDownCircle className="h-6 w-6 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-extrabold text-red-700 dark:text-red-300">{MOCK_EXPENSE_DATA.total.toLocaleString('vi-VN')}đ</div>
             <Separator className="my-4"/>
             <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center"><span className="flex items-center gap-2"><Wallet className="text-gray-500"/>Chi tiền mặt:</span> <span className="font-medium">{MOCK_EXPENSE_DATA.breakdown.cash.toLocaleString('vi-VN')}đ</span></div>
                <div className="flex justify-between items-center"><span className="flex items-center gap-2"><LandPlot className="text-blue-500"/>Chi chuyển khoản:</span> <span className="font-medium">{MOCK_EXPENSE_DATA.breakdown.bank_transfer.toLocaleString('vi-VN')}đ</span></div>
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
                        <CardTitle>Chi phí theo hạng mục</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <RechartsBarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip formatter={(value: number) => `${value.toLocaleString('vi-VN')}đ`} />
                                <Bar dataKey="Chi phí" fill="#ef4444" radius={[0, 4, 4, 0]} />
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Tỷ trọng chi phí</CardTitle>
                    </CardHeader>
                    <CardContent>
                       <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={chartData} dataKey="Chi phí" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
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
          <Accordion type="multiple" defaultValue={MOCK_DETAILED_DATA.map(d => d.date)} className="space-y-2">
            {MOCK_DETAILED_DATA.map((dayData, index) => (
              <AccordionItem value={dayData.date} key={index} className="bg-white dark:bg-card border rounded-lg">
                <AccordionTrigger className="p-4 text-base font-semibold">
                  Ngày {format(new Date(dayData.date), "dd/MM/yyyy")}
                </AccordionTrigger>
                <AccordionContent className="p-4 border-t">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                        <h4 className="font-semibold mb-2 text-green-600">Doanh thu</h4>
                        <Table>
                            <TableBody>
                                {dayData.revenue.items.map((item, idx) => (
                                    <TableRow key={`rev-${idx}`}>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell className="text-right font-medium text-green-600">{item.amount.toLocaleString('vi-VN')}đ</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-2 text-red-600">Chi phí</h4>
                        <Table>
                            <TableBody>
                                {dayData.expenses.map((item, idx) => (
                                    <TableRow key={`exp-${idx}`}>
                                        <TableCell>
                                            {item.name}
                                            <Badge variant={item.method === 'cash' ? 'secondary' : 'outline'} className="ml-2">{item.method === 'cash' ? 'Tiền mặt' : 'CK'}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-red-600">{item.amount.toLocaleString('vi-VN')}đ</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>
      </Tabs>
    </div>
  );
}
