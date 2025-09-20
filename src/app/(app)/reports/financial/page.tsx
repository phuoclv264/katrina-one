
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Filter, Search, X } from 'lucide-react';
import type { ExpenseSlip, IncidentReport, RevenueStats, InventoryItem } from '@/lib/types';
import { dataStore } from '@/lib/data-store';
import { format, parseISO } from 'date-fns';
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

type ReportItem = (ExpenseSlip | IncidentReport | RevenueStats) & { type: 'expense' | 'incident' | 'revenue' };

function FinancialReportList({ items }: { items: ReportItem[] }) {
    if (items.length === 0) {
        return (
            <div className="text-center py-16 text-muted-foreground">
                <p>Không có báo cáo nào khớp với bộ lọc.</p>
            </div>
        );
    }
    
    const renderItem = (item: ReportItem) => {
        switch(item.type) {
            case 'expense':
                const expense = item as ExpenseSlip;
                return (
                    <Card key={expense.id} className="bg-red-500/5">
                        <CardHeader>
                            <CardTitle className="text-base font-semibold">Phiếu chi - {expense.totalAmount.toLocaleString('vi-VN')}đ</CardTitle>
                            <CardDescription>{expense.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'} - bởi {expense.createdBy.userName}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ul className="list-disc pl-5 text-sm space-y-1">
                                {expense.items.map((i, idx) => <li key={idx}>{i.name} (SL: {i.quantity}, ĐG: {i.unitPrice.toLocaleString('vi-VN')}đ)</li>)}
                            </ul>
                            {expense.notes && <p className="text-xs italic mt-2 text-muted-foreground">"{expense.notes}"</p>}
                        </CardContent>
                    </Card>
                );
            case 'incident':
                const incident = item as IncidentReport;
                return (
                    <Card key={incident.id} className="bg-yellow-500/5">
                        <CardHeader>
                            <CardTitle className="text-base font-semibold">Sự cố (Chi phí: {incident.cost.toLocaleString('vi-VN')}đ)</CardTitle>
                            <CardDescription>Báo cáo bởi {incident.createdBy.userName}</CardDescription>
                        </CardHeader>
                        <CardContent><p className="text-sm">{incident.content}</p></CardContent>
                    </Card>
                );
            case 'revenue':
                 const revenue = item as RevenueStats;
                return (
                     <Card key={revenue.id} className="bg-green-500/5">
                        <CardHeader>
                            <CardTitle className="text-base font-semibold">Doanh thu Net - {revenue.netRevenue.toLocaleString('vi-VN')}đ</CardTitle>
                            <CardDescription>Cập nhật bởi {revenue.createdBy.userName}</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm space-y-1">
                            <p>Tiền mặt: {revenue.revenueByPaymentMethod.cash.toLocaleString('vi-VN')}đ</p>
                            <p>Chuyển khoản: {(revenue.revenueByPaymentMethod.bankTransfer + revenue.revenueByPaymentMethod.techcombankVietQrPro).toLocaleString('vi-VN')}đ</p>
                            <p>App giao hàng: {(revenue.revenueByPaymentMethod.shopeeFood + revenue.revenueByPaymentMethod.grabFood).toLocaleString('vi-VN')}đ</p>
                        </CardContent>
                    </Card>
                );
            default:
                return null;
        }
    };
    
    return <div className="space-y-4">{items.map(renderItem)}</div>;
}


export default function FinancialReportsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [expenseSlips, setExpenseSlips] = useState<ExpenseSlip[]>([]);
    const [incidents, setIncidents] = useState<IncidentReport[]>([]);
    const [revenueStats, setRevenueStats] = useState<RevenueStats[]>([]);
    const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Filters
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [reportType, setReportType] = useState('all');
    const [paymentMethod, setPaymentMethod] = useState('all');
    const [itemNameFilter, setItemNameFilter] = useState('');

    useEffect(() => {
        if (!authLoading && user?.role !== 'Chủ nhà hàng') {
            router.replace('/');
        }
    }, [user, authLoading, router]);
    
    useEffect(() => {
        if (!user) return;
        
        const unsubExpense = dataStore.subscribeToAllExpenseSlips(setExpenseSlips);
        const unsubIncidents = dataStore.subscribeToAllIncidents(setIncidents);
        const unsubRevenue = dataStore.subscribeToAllRevenueStats(setRevenueStats);
        const unsubInventory = dataStore.subscribeToInventoryList(setInventoryList);

        Promise.all([unsubExpense, unsubIncidents, unsubRevenue, unsubInventory]).then(() => setIsLoading(false));

        return () => {
            unsubExpense();
            unsubIncidents();
            unsubRevenue();
            unsubInventory();
        };
    }, [user]);

    const filteredItems = useMemo((): ReportItem[] => {
        let combined: ReportItem[] = [
            ...expenseSlips.map(item => ({ ...item, type: 'expense' as const })),
            ...incidents.map(item => ({ ...item, type: 'incident' as const })),
            ...revenueStats.map(item => ({ ...item, type: 'revenue' as const })),
        ];

        // Filter by Date Range
        if (dateRange?.from) {
            combined = combined.filter(item => {
                const itemDate = parseISO(item.date);
                const from = dateRange.from!;
                const to = dateRange.to || from;
                return itemDate >= from && itemDate <= to;
            });
        }
        
        // Filter by Report Type
        if (reportType !== 'all') {
            combined = combined.filter(item => item.type === reportType);
        }
        
        // Filter by Payment Method (only for expenses)
        if (paymentMethod !== 'all' && reportType !== 'revenue' && reportType !== 'incident') {
            combined = combined.filter(item => {
                if (item.type === 'expense') {
                    return item.paymentMethod === paymentMethod;
                }
                return true;
            });
        }

        // Filter by Item Name (only for expenses)
        if (itemNameFilter && reportType !== 'revenue' && reportType !== 'incident') {
            const lowerCaseFilter = itemNameFilter.toLowerCase();
            combined = combined.filter(item => {
                if (item.type === 'expense') {
                    return item.items.some(i => i.name.toLowerCase().includes(lowerCaseFilter));
                }
                return true;
            });
        }

        // Sort by date descending
        return combined.sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime());

    }, [expenseSlips, incidents, revenueStats, dateRange, reportType, paymentMethod, itemNameFilter]);
    
    const clearFilters = () => {
        setDateRange(undefined);
        setReportType('all');
        setPaymentMethod('all');
        setItemNameFilter('');
    }

    if (isLoading || authLoading) {
        return (
            <div className="container mx-auto p-4 sm:p-6 md:p-8">
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
                <h1 className="text-3xl font-bold font-headline">Báo cáo Tài chính</h1>
                <p className="text-muted-foreground mt-2">
                    Tổng hợp và phân tích toàn bộ hoạt động thu chi của nhà hàng.
                </p>
            </header>

            <Card className="mb-8">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Filter className="h-5 w-5" /> Bộ lọc
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                     <Popover>
                        <PopoverTrigger asChild>
                          <Button variant={"outline"} className="w-full justify-start text-left font-normal">
                            {dateRange?.from ? (
                              dateRange.to ? (
                                <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>
                              ) : (
                                format(dateRange.from, "LLL dd, y")
                              )
                            ) : (
                              <span>Chọn khoảng ngày</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            initialFocus
                            mode="range"
                            selected={dateRange}
                            onSelect={setDateRange}
                            numberOfMonths={2}
                          />
                        </PopoverContent>
                      </Popover>
                      <Select value={reportType} onValueChange={setReportType}>
                          <SelectTrigger><SelectValue/></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">Tất cả loại báo cáo</SelectItem>
                              <SelectItem value="expense">Phiếu chi</SelectItem>
                              <SelectItem value="incident">Sự cố</SelectItem>
                              <SelectItem value="revenue">Doanh thu</SelectItem>
                          </SelectContent>
                      </Select>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod} disabled={reportType === 'revenue' || reportType === 'incident'}>
                          <SelectTrigger><SelectValue/></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">Tất cả hình thức</SelectItem>
                              <SelectItem value="cash">Tiền mặt</SelectItem>
                              <SelectItem value="bank_transfer">Chuyển khoản</SelectItem>
                          </SelectContent>
                      </Select>
                       <div className="relative md:col-span-2 lg:col-span-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Lọc theo tên mặt hàng..."
                                value={itemNameFilter}
                                onChange={(e) => setItemNameFilter(e.target.value)}
                                className="pl-8"
                                disabled={reportType === 'revenue' || reportType === 'incident'}
                            />
                       </div>
                       <Button variant="ghost" onClick={clearFilters} className="lg:col-start-3">
                            <X className="mr-2 h-4 w-4"/> Xóa bộ lọc
                       </Button>
                </CardContent>
            </Card>
            
            <FinancialReportList items={filteredItems} />
            
        </div>
    )
}
