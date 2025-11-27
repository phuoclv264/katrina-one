

'use client';
import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDataRefresher } from '@/hooks/useDataRefresher';
import { useRouter } from 'nextjs-toploader/app';
import { dataStore } from '@/lib/data-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { InventoryItem, ExpenseSlip, InventoryReport } from '@/lib/types';
import { LoadingPage } from '@/components/loading/LoadingPage';
import { ArrowLeft, Filter, History, ShoppingCart, TestTube2, ArrowUp, ArrowDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SupplierCombobox } from '@/components/supplier-combobox';
import { Input } from '@/components/ui/input';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type CombinedHistoryEntry = {
    date: string | Date;
    itemName: string;
    itemUnit: string;
    itemSupplier: string;
    type: 'Nhập hàng' | 'Kiểm kê';
    change: string; 
    changeType: 'increase' | 'decrease' | 'neutral';
    newStock: string;
    priceInfo: string;
    sourceId: string;
};

// For list-based stock items
const STOCK_LIST_NUMERIC_VALUE: { [key: string]: number } = {
    'hết': 0,
    'gần hết': 1,
    'còn đủ': 2,
    'dư xài': 3
};


function InventoryHistoryView() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
    const [expenseSlips, setExpenseSlips] = useState<ExpenseSlip[]>([]);
    const [inventoryReports, setInventoryReports] = useState<InventoryReport[]>([]);
    const [suppliers, setSuppliers] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [filterItemName, setFilterItemName] = useState<string>('');
    const [filterSupplier, setFilterSupplier] = useState<string>('');
    const [filterType, setFilterType] = useState<string>('all');
    
    const [sortColumn, setSortColumn] = useState<'date' | 'itemName'>('date');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');


    useEffect(() => {
        if (!authLoading && (!user || user.role !== 'Chủ nhà hàng')) {
            router.replace('/');
        }
    }, [user, authLoading, router]);

    const handleReconnect = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    useEffect(() => {
        if (!user) return;
        
        const unsubInventory = dataStore.subscribeToInventoryList(setInventoryList);
        const unsubSuppliers = dataStore.subscribeToSuppliers(setSuppliers);
        const unsubExpenses = dataStore.subscribeToAllExpenseSlips(setExpenseSlips);
        const unsubReports = dataStore.subscribeToAllInventoryReports(setInventoryReports);

        return () => {
            unsubInventory();
            unsubSuppliers();
            unsubExpenses();
            unsubReports();
        };
    }, [user, refreshTrigger]);

    useDataRefresher(handleReconnect);

    useEffect(() => {
        if (isLoading && (inventoryList.length > 0 || expenseSlips.length > 0 || inventoryReports.length > 0 || suppliers.length > 0 || user)) {
            setIsLoading(false);
        }
    }, [inventoryList, expenseSlips, inventoryReports, suppliers, user]);
    
    const combinedHistory = useMemo((): CombinedHistoryEntry[] => {
        const itemMap = new Map(inventoryList.map(item => [item.id, item]));
        const allEvents: any[] = [];

        // 1. Prepare all events
        expenseSlips.forEach(slip => {
            slip.items.forEach(item => {
                const inventoryItem = itemMap.get(item.itemId);
                if (!inventoryItem) return;
                allEvents.push({
                    type: 'expense',
                    date: slip.createdAt as string,
                    itemId: item.itemId,
                    data: item,
                    sourceId: slip.id,
                });
            });
        });

        inventoryReports.forEach(report => {
            for (const itemId in report.stockLevels) {
                const record = report.stockLevels[itemId];
                if (record.stock === undefined || String(record.stock).trim() === '') continue;
                allEvents.push({
                    type: 'report',
                    date: report.submittedAt as string,
                    itemId: itemId,
                    data: record,
                    sourceId: report.id,
                });
            }
        });

        // 2. Sort all events chronologically (oldest first)
        allEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        // 3. Process events to calculate running stock
        const runningStock = new Map<string, number>();
        const latestPriceMap = new Map<string, { price: number; unit: string }>();
        const processedHistory: CombinedHistoryEntry[] = [];

        allEvents.forEach(event => {
            const inventoryItem = itemMap.get(event.itemId);
            if (!inventoryItem) return;

            const previousStock = runningStock.get(event.itemId) || 0;
            let newStock = previousStock;
            let change = '';
            let changeType: CombinedHistoryEntry['changeType'] = 'neutral';
            let newStockDisplay = '-';
            
            if (event.type === 'expense') {
                const expenseItem = event.data as ExpenseSlip['items'][0];
                const selectedUnitDef = inventoryItem.units.find(u => u.name === expenseItem.unit);
                const conversionRate = selectedUnitDef?.conversionRate || 1;
                const quantityInBaseUnit = expenseItem.quantity * conversionRate;
                
                const orderUnitName = inventoryItem.units.find(u => !u.isBaseUnit)?.name || inventoryItem.baseUnit;
                latestPriceMap.set(event.itemId, { price: expenseItem.unitPrice, unit: orderUnitName });
                
                if (inventoryItem.dataType === 'number') {
                    newStock = previousStock + quantityInBaseUnit;
                    runningStock.set(event.itemId, newStock);
                    change = `+${quantityInBaseUnit.toLocaleString()}`;
                    newStockDisplay = String(newStock.toLocaleString());
                } else { // 'list' type
                    newStock = STOCK_LIST_NUMERIC_VALUE['dư xài'];
                    runningStock.set(event.itemId, newStock);
                    const prevStockKey = Object.keys(STOCK_LIST_NUMERIC_VALUE).find(key => STOCK_LIST_NUMERIC_VALUE[key] === previousStock);
                    change = `${prevStockKey || previousStock} → dư xài`;
                    newStockDisplay = 'dư xài';
                }
                changeType = 'increase';
            } 
            else if (event.type === 'report') {
                const reportItem = event.data as InventoryReport['stockLevels'][0];
                const isNumeric = inventoryItem.dataType === 'number';

                if (isNumeric) {
                    const reportedStock = Number(reportItem.stock);
                    newStock = reportedStock;
                    runningStock.set(event.itemId, newStock);
                    const diff = reportedStock - previousStock;
                    
                    const diffFormatted = diff.toFixed(2).replace(/\.00$/, '');
                    change = diff === 0 ? '0' : (diff > 0 ? `+${diffFormatted}` : diffFormatted);
                    changeType = diff > 0 ? 'increase' : (diff < 0 ? 'decrease' : 'neutral');

                    newStockDisplay = String(reportedStock);
                } else { // List type
                    const reportedValue = String(reportItem.stock).toLowerCase();
                    const reportedStockValue = STOCK_LIST_NUMERIC_VALUE[reportedValue] ?? -1;
                    const previousStockValue = previousStock;
                    
                    newStock = reportedStockValue;
                    runningStock.set(event.itemId, newStock);

                    if (reportedStockValue === previousStockValue) {
                        change = reportedValue;
                        changeType = 'neutral';
                    } else {
                        const prevStockKey = Object.keys(STOCK_LIST_NUMERIC_VALUE).find(key => STOCK_LIST_NUMERIC_VALUE[key] === previousStockValue);
                        change = `${prevStockKey || previousStockValue} → ${reportedValue}`;
                        changeType = reportedStockValue > previousStockValue ? 'increase' : 'decrease';
                    }
                    newStockDisplay = String(reportItem.stock);
                }
            }

            const latestPriceInfo = latestPriceMap.get(event.itemId);
            const orderUnitName = inventoryItem.units.find(u => !u.isBaseUnit)?.name || inventoryItem.baseUnit;
            const priceInfo = latestPriceInfo ? `${latestPriceInfo.price.toLocaleString('vi-VN')}đ / ${orderUnitName}` : '0đ';

            processedHistory.push({
                date: event.date,
                itemName: inventoryItem.name,
                itemUnit: inventoryItem.baseUnit,
                itemSupplier: inventoryItem.supplier,
                type: event.type === 'expense' ? 'Nhập hàng' : 'Kiểm kê',
                change: change,
                changeType: changeType,
                newStock: newStockDisplay,
                priceInfo: priceInfo,
                sourceId: event.sourceId,
            });
        });

        // 4. Filter
        let filtered = processedHistory.filter(entry => {
             if (filterItemName && !entry.itemName.toLowerCase().includes(filterItemName.toLowerCase())) {
                return false;
            }
            if (filterSupplier && entry.itemSupplier !== filterSupplier) {
                return false;
            }
            if (filterType !== 'all' && entry.type !== filterType) {
                return false;
            }
            return true;
        });

        // 5. Sort for display (newest first by default)
        filtered.sort((a, b) => {
            if (sortColumn === 'date') {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
            }
            if (sortColumn === 'itemName') {
                 const comparison = a.itemName.localeCompare(b.itemName, 'vi');
                 return sortDirection === 'asc' ? comparison : -comparison;
            }
            return 0;
        });

        return filtered;
    }, [inventoryList, expenseSlips, inventoryReports, filterItemName, filterSupplier, filterType, sortColumn, sortDirection]);
    
    const handleSort = (column: 'date' | 'itemName') => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('desc');
        }
    }
    
    const SortIndicator = ({ column }: { column: 'date' | 'itemName' }) => {
        if (sortColumn !== column) return null;
        return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
    };


    if (isLoading || authLoading) {
        return <LoadingPage />;
    }
    
    const getChangeColorClass = (changeType: CombinedHistoryEntry['changeType']): string => {
        switch (changeType) {
            case 'increase': return 'text-green-600 dark:text-green-400';
            case 'decrease': return 'text-red-600 dark:text-red-400';
            default: return 'text-muted-foreground';
        }
    }
    
    return (
        <div className="container mx-auto max-w-7xl p-4 sm:p-6 md:p-8">
            <header className="mb-8">
                <Button variant="ghost" className="-ml-4 mb-4" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Quay lại QL Hàng tồn kho
                </Button>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><History/> Lịch sử Kho</h1>
                <p className="text-muted-foreground mt-2">
                    Truy vết mọi thay đổi về giá cả và số lượng tồn kho của tất cả mặt hàng.
                </p>
            </header>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Filter/> Bộ lọc</CardTitle>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
                        <Input 
                            placeholder="Lọc theo tên mặt hàng..."
                            value={filterItemName}
                            onChange={(e) => setFilterItemName(e.target.value)}
                        />
                        <SupplierCombobox suppliers={suppliers} value={filterSupplier} onChange={setFilterSupplier} />
                        <Select value={filterType} onValueChange={setFilterType}>
                            <SelectTrigger><SelectValue placeholder="Lọc theo loại sự kiện..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Tất cả sự kiện</SelectItem>
                                <SelectItem value="Nhập hàng">Nhập hàng</SelectItem>
                                <SelectItem value="Kiểm kê">Kiểm kê</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" onClick={() => { setFilterItemName(''); setFilterSupplier(''); setFilterType('all'); }}>Xóa bộ lọc</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('date')}>
                                        <div className="flex items-center">Thời gian <SortIndicator column="date" /></div>
                                    </TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('itemName')}>
                                         <div className="flex items-center">Tên mặt hàng <SortIndicator column="itemName" /></div>
                                    </TableHead>
                                    <TableHead>Sự kiện</TableHead>
                                    <TableHead>Thay đổi</TableHead>
                                    <TableHead>Tồn kho mới</TableHead>
                                    <TableHead>Đơn giá</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {combinedHistory.length > 0 ? combinedHistory.map((entry, index) => (
                                    <TableRow key={`${entry.sourceId}-${index}`}>
                                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{format(parseISO(entry.date as string), 'dd/MM/yyyy HH:mm', { locale: vi })}</TableCell>
                                        <TableCell className="font-semibold">{entry.itemName}</TableCell>
                                        <TableCell>
                                            <Badge variant={entry.type === 'Nhập hàng' ? 'default' : 'secondary'}>
                                                {entry.type === 'Nhập hàng' ? <ShoppingCart className="h-3 w-3 mr-1.5"/> : <TestTube2 className="h-3 w-3 mr-1.5"/>}
                                                {entry.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={cn("font-medium", getChangeColorClass(entry.changeType))}>
                                            {entry.change || '-'}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {entry.newStock || '-'}
                                        </TableCell>
                                        <TableCell className="font-mono">
                                            {entry.priceInfo}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">Không có dữ liệu lịch sử nào khớp.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}


export default function InventoryHistoryPage() {
    return (
        <Suspense fallback={<div className="h-screen w-full flex items-center justify-center"><Skeleton className="w-full h-full" /></div>}>
            <InventoryHistoryView />
        </Suspense>
    )
}
